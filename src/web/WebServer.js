import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/Logger.js';
import fixedScheduler from '../schedulers/CrawlerScheduler.js';
import dynamicScheduler from '../schedulers/DynamicCrawlerScheduler.js';
import continuousScheduler from '../schedulers/ContinuousPollingScheduler.js';
import multiSourceDataManager from '../services/MultiSourceDataManager.js';
import officialSourceManager from '../managers/OfficialSourceManager.js';
import configManager from '../config/ConfigManager.js';
import lotteryConfigManager from '../managers/LotteryConfigManager.js';
import database from '../db/Database.js';
import databaseMonitor from '../db/DatabaseMonitor.js';
import databaseMaintenance from '../db/DatabaseMaintenance.js';
import historyBackfill from '../db/HistoryBackfill.js';
import schedulerAPI from './SchedulerAPI.js';
import WebSocketManager from './WebSocketManager.js';
import CountdownManager from './CountdownManager.js';  // 🕐 倒计时管理器
import { lotteryConfigs } from '../config/crawlerConfig.js';
import fs from 'fs';
// import alertService from '../alerts/AlertService.js';  // ⚠️ 旧版内存告警服务已弃用
// import alertManager from '../alerts/AlertManager.js';  // ⚠️ 旧版告警管理器已弃用
import AlertServiceDB from '../services/AlertService.js';  // 数据库驱动的告警服务
import SettingsService from '../services/SettingsService.js';  // 系统设置服务
import alertServiceManager from '../services/AlertServiceManager.js';  // 🎯 全局告警服务管理器
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Web管理界面服务器
 */
class WebServer {
  constructor(port = 4000) {
    this.port = port;
    this.app = express();
    this.server = null;
    this.wsManager = null; // 🎯 WebSocket 管理器
    this.countdownManager = null; // 🕐 倒计时管理器
    this.alertServiceDB = null; // 🎯 数据库驱动的告警服务（待初始化）
    this.settingsService = null; // 🎯 系统设置服务
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * 配置中间件
   */
  setupMiddleware() {
    this.app.use(express.json());

    // Vue 3界面 - 禁用缓存以便开发调试
    this.app.use(express.static(path.join(__dirname, 'dist'), {
      maxAge: 0,  // 不缓存
      etag: false,  // 禁用ETag
      lastModified: false,  // 禁用Last-Modified
      setHeaders: (res) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
      }
    }));
  }

  /**
   * 配置路由
   */
  setupRoutes() {
    // 注册调度器API
    schedulerAPI.registerRoutes(this.app);

    // API: 获取系统状态
    this.app.get('/api/status', async (req, res) => {
      try {
        // 使用正确的调度器（根据环境变量决定）
        const schedulerMode = process.env.SCHEDULER_MODE || 'continuous';
        const activeScheduler =
          schedulerMode === 'fixed' ? fixedScheduler :
          schedulerMode === 'dynamic' ? dynamicScheduler :
          continuousScheduler;

        const stats = activeScheduler.getStats();
        const sourcesRaw = officialSourceManager.getSources();
        const dbStats = await database.getDataStats();
        const autoEnabled = configManager.getAutoCrawlEnabled();
        const enabledLotteries = lotteryConfigManager.getEnabledLotteries();

        // 🔧 过滤sources，移除循环引用对象（scraperInstance包含domainManager/Pool）
        const sourcesStatus = sourcesRaw.map(source => ({
          id: source.id,
          name: source.name,
          url: source.url,
          scraper: source.scraper,
          type: source.type,
          priority: source.priority,
          status: source.status,
          enabled: source.enabled,
          description: source.description,
          stats: source.stats
          // 不包含 scraperInstance（避免循环引用）
        }));

        res.json({
          success: true,
          data: {
            mode: autoEnabled ? 'active' : 'monitoring',
            config: {
              enableAutoCrawl: autoEnabled
            },
            scheduler: {
              isRunning: activeScheduler.isRunning,
              ...stats
            },
            sources: sourcesStatus,
            lotteries: {
              total: enabledLotteries.length,
              high: enabledLotteries.filter(c => c.priority === 'high').length,
              medium: enabledLotteries.filter(c => c.priority === 'medium').length,
              low: enabledLotteries.filter(c => c.priority === 'low').length
            },
            database: {
              totalLotteries: dbStats.total_lotteries,
              totalRecords: dbStats.total_records,
              lastUpdate: dbStats.last_update
            },
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        logger.error('获取系统状态失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 获取彩种列表
    this.app.get('/api/lotteries', (req, res) => {
      const enabledLotteries = lotteryConfigManager.getEnabledLotteries();
      res.json({
        success: true,
        data: enabledLotteries.map(c => ({
          lotCode: c.lotCode,
          name: c.name,
          interval: c.interval,
          priority: c.priority,
          source: c.source,
          enabled: c.enabled,
          tags: c.tags || [] // 🏷️ 返回彩种标签
        }))
      });
    });

    // API: 获取实时数据（直接从官方数据源获取，不走数据库，速度最快）
    this.app.get('/api/realtime-data', async (req, res) => {
      try {
        const { lotCode } = req.query;

        if (!lotCode) {
          return res.status(400).json({
            success: false,
            error: '请提供 lotCode 参数'
          });
        }

        // 使用MultiSourceDataManager从官方数据源获取实时数据
        const result = await multiSourceDataManager.fetchLotteryData(lotCode);

        if (result && result.success && result.data) {
          const realtimeData = result.data;

          // 🚀 修复倒计时：对于 SpeedyLot88 彩种，需要基于数据库时间重新计算
          // 注意：从MultiSourceDataManager返回的字段名是 officialCountdown
          let finalCountdown = realtimeData.officialCountdown || realtimeData.countdown;
          const lotteryConfig = lotteryConfigManager.getLottery(lotCode);
          // 🎯 获取数据源配置（包含彩种特定的drawInterval）
          const sourceConfig = officialSourceManager.getSourceForLottery(lotCode);

          // logger.debug(`[API-Realtime] ${lotCode} - RAW countdown: ${finalCountdown}, behavior: ${sourceConfig?.countdownBehavior}, earlyFetch: ${sourceConfig?.earlyFetch || 0}`);

          if (sourceConfig?.countdownBehavior === 'wait_for_zero') {
            // ✅ SpeedyLot88彩种：优先使用CountdownManager的倒计时值
            // 策略：CountdownManager通过tick()每秒递减，消除跳变，与WebSocket保持一致
            // Fallback：如果CountdownManager没有数据，使用爬虫返回的实时倒计时

            const countdownState = this.countdownManager?.getState(lotCode);

            if (countdownState && countdownState.countdown !== undefined) {
              // 优先使用CountdownManager的倒计时值
              finalCountdown = countdownState.countdown;
              logger.debug(
                `[API-Realtime] ${lotCode} 极速彩使用CountdownManager倒计时: ${finalCountdown}秒 ` +
                `(period=${countdownState.period})`
              );
            } else {
              // Fallback 1: 使用调度器中的精确时间戳（毫秒级）
              const lastDrawTimestamp = continuousScheduler.getLastDrawTimestamp(lotCode);
              const drawInterval = sourceConfig?.drawInterval || 75;
              const earlyFetch = sourceConfig?.earlyFetch || 0; // 提前获取数据的秒数

              if (lastDrawTimestamp) {
                // 使用调度器的精确毫秒级时间戳
                const currentTimeMs = Date.now();
                const elapsed = (currentTimeMs - lastDrawTimestamp) / 1000;
                const calculatedCountdown = Math.max(0, drawInterval - elapsed);
                // 🎯 对于有earlyFetch的彩种（如极速六合彩），加上earlyFetch秒显示
                finalCountdown = earlyFetch > 0
                  ? Math.round(calculatedCountdown) + earlyFetch
                  : Math.round(calculatedCountdown);
                logger.warn(
                  `[API-Realtime] ${lotCode} CountdownManager无数据，使用调度器时间戳: ${finalCountdown}秒`
                );
              } else {
                // Fallback 2: 从数据库获取created_at（仅秒级精度）
                const dbData = await database.getLatestData(lotCode);
                if (dbData && dbData.created_at) {
                  const currentTime = Math.floor(Date.now() / 1000);
                  const lastDrawTime = new Date(dbData.created_at).getTime() / 1000;
                  const elapsed = currentTime - lastDrawTime;
                  const calculatedCountdown = Math.max(0, drawInterval - elapsed);
                  // 🎯 对于有earlyFetch的彩种（如极速六合彩），加上earlyFetch秒显示
                  finalCountdown = earlyFetch > 0
                    ? Math.round(calculatedCountdown) + earlyFetch
                    : Math.round(calculatedCountdown);
                  logger.warn(
                    `[API-Realtime] ${lotCode} CountdownManager无数据，使用数据库时间: ${finalCountdown}秒`
                  );
                }
              }
            }
          } else if (sourceConfig?.countdownBehavior === 'immediate_draw') {
            // 🎯 统一策略：所有immediate_draw彩种优先使用CountdownManager（扩展到所有AU/UK/SG彩种）
            // 原因：与批量API保持一致，避免"手动刷新"时获取到不同步的倒计时
            const countdownState = this.countdownManager?.getState(lotCode);
            if (countdownState && countdownState.countdown !== undefined) {
              finalCountdown = countdownState.countdown;
              logger.debug(
                `[API-Realtime] ${lotCode} immediate_draw使用CountdownManager倒计时: ${finalCountdown}秒 ` +
                `(period=${countdownState.period})`
              );
            } else {
              // Fallback: CountdownManager没有数据时，使用MultiSourceDataManager返回的倒计时
              finalCountdown = realtimeData.officialCountdown || 0;
              logger.warn(
                `[API-Realtime] ${lotCode} CountdownManager无数据，使用Fallback倒计时: ${finalCountdown}秒`
              );
            }
            // 🔧 AU彩种特殊处理：倒计时<10秒时锁定为0，避免新旧期号切换时跳动
            if (lotCode.startsWith('300') && finalCountdown > 0 && finalCountdown < 10) {
              finalCountdown = 0;
              logger.debug(`[API-Realtime] ${lotCode} 倒计时<10秒，锁定为0（避免跳动）`);
            }
          }

          res.json({
            success: true,
            data: {
              lotCode: realtimeData.lotCode,
              issue: realtimeData.issue || realtimeData.period,
              drawCode: realtimeData.drawCode || realtimeData.opencode,
              drawTime: realtimeData.drawTime,
              extra: realtimeData.extra,  // 特别号（香港六合彩等彩种使用）
              nextIssue: realtimeData.nextIssue,
              nextDrawTime: realtimeData.nextDrawTime,
              countdown: finalCountdown,
              serverTime: new Date().toISOString(),
              source: result.source || 'speedylot88', // 标记数据源
              fromCache: result.fromCache || false
            }
          });
        } else {
          res.status(404).json({
            success: false,
            error: result?.error || '无法获取实时数据'
          });
        }
      } catch (error) {
        logger.error(`获取实时数据失败: ${req.query.lotCode}`, error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // ⚡ 添加短期内存缓存（1秒），减少临界区轮询时的性能开销
    let latestDataCache = null;
    let latestDataCacheTime = 0;
    const CACHE_TTL = 1000; // 1秒缓存

    // API: 获取最新数据（从数据库 + 实时倒计时）
    this.app.get('/api/latest-data', async (req, res) => {
      try {
        const { lotCode, includeCountdown = 'true' } = req.query;
        const shouldIncludeCountdown = includeCountdown !== 'false';

        // ⚡ 如果没有指定lotCode且在缓存有效期内，返回缓存
        // 🎯 但需要重新计算倒计时，因为时间在流逝
        if (!lotCode && latestDataCache && (Date.now() - latestDataCacheTime) < CACHE_TTL) {
          const cacheAge = Date.now() - latestDataCacheTime;
          const cacheAgeSeconds = Math.floor(cacheAge / 1000);

          // 🔧 重新计算所有彩种的倒计时
          const updatedCache = latestDataCache.map(item => {
            if (item.officialCountdown !== null && item.officialCountdown !== undefined) {
              // 🎯 统一策略：所有彩种优先使用CountdownManager（扩展到41个彩种）
              const countdownState = this.countdownManager?.getState(item.lotCode);
              if (countdownState && countdownState.countdown !== undefined) {
                logger.debug(
                  `[API-Batch-Cache] ${item.lotCode} 使用CountdownManager: ${countdownState.countdown}秒`
                );
                return {
                  ...item,
                  officialCountdown: countdownState.countdown
                };
              } else {
                // Fallback：CountdownManager无数据，减去缓存时间
                logger.debug(
                  `[API-Batch-Cache] ${item.lotCode} CountdownManager无数据，使用缓存计算: ${Math.max(0, item.officialCountdown - cacheAgeSeconds)}秒`
                );
                return {
                  ...item,
                  officialCountdown: Math.max(0, item.officialCountdown - cacheAgeSeconds)
                };
              }
            }
            return item;
          });

          return res.json({
            success: true,
            data: updatedCache,
            cached: true,
            cacheAge: cacheAge
          });
        }

        if (lotCode) {
          // 获取单个彩种数据
          const data = await database.getLatestData(lotCode);

          // 如果需要倒计时，从官方数据源获取
          if (shouldIncludeCountdown && data) {
            try {
              const currentTime = Math.floor(Date.now() / 1000); // 当前Unix时间戳（秒）
              const realtimeData = await multiSourceDataManager.fetchLotteryData(lotCode);

              // 🧹 调试日志已移除（SG彩种监控已完成）

              if (realtimeData && realtimeData.success && realtimeData.data) {
                // 🔧 重新计算倒计时，避免缓存导致的时间偏差
                const rtData = realtimeData.data;
                const lotteryConfig = lotteryConfigManager.getLottery(lotCode);
                // 🎯 获取数据源配置（包含彩种特定的drawInterval）
                const sourceConfig = officialSourceManager.getSourceForLottery(lotCode);

                // 如果有unixtime字段（SG彩种、AU彩种、UK Lottos），使用与官网一致的固定间隔算法
                if (rtData.unixtime || data.unixtime) {
                  // 🎯 使用数据源配置的drawInterval，而不是硬编码300秒（UK Lottos是150秒）
                  const drawInterval = sourceConfig?.drawInterval || 300; // 默认5分钟
                  const earlyFetch = sourceConfig?.earlyFetch || 0; // 🚀 提前获取数据的秒数（SG=22秒，AU=-9秒~0秒，UK=19秒）
                  const countdownBehavior = sourceConfig?.countdownBehavior || 'immediate_draw';

                  // 🎯 优先使用数据库的unixtime（最准确的已入库数据）
                  // 只有当实时爬虫返回的是新期号时，才使用爬虫的unixtime
                  const dbUnixtime = data.unixtime;
                  const rtUnixtime = rtData.unixtime;
                  const useUnixtime = (rtUnixtime > dbUnixtime) ? rtUnixtime : dbUnixtime;

                  const timeElapsed = currentTime - useUnixtime;
                  const rawCountdown = drawInterval - timeElapsed;

                  // 🎯 统一策略：所有彩种优先使用CountdownManager
                  // 原因：CountdownManager每秒tick递减，与WebSocket完全一致，避免跳变
                  let finalCountdown;
                  const countdownState = this.countdownManager?.getState(lotCode);
                  if (countdownState && countdownState.countdown !== undefined) {
                    // ✅ 优先：使用CountdownManager（内存值，零延迟，完全一致）
                    finalCountdown = countdownState.countdown;
                    logger.debug(
                      `[API-Single] ${lotCode} 使用CountdownManager: ${finalCountdown}秒 ` +
                      `(period=${countdownState.period})`
                    );
                  } else {
                    // ⚠️ Fallback：CountdownManager无数据，基于unixtime计算
                    if (rawCountdown > drawInterval) {
                      // 检测到未来时间：计算真实倒计时到下一期
                      const nextDrawTime = rtData.unixtime + drawInterval;
                      finalCountdown = Math.max(0, nextDrawTime - currentTime);
                      logger.debug(
                        `[API-Single] ${lotCode} 未来时间，计算真实倒计时: ${finalCountdown}秒`
                      );
                    } else {
                      // 正常倒计时（不减earlyFetch，由CountdownManager统一处理）
                      finalCountdown = Math.max(0, rawCountdown);
                      logger.debug(
                        `[API-Single] ${lotCode} 使用unixtime计算: ${finalCountdown}秒`
                      );
                    }
                  }

                  // 🔧 AU彩种特殊处理：倒计时<10秒时锁定为0，避免新旧期号切换时跳动
                  if (lotCode.startsWith('300') && finalCountdown > 0 && finalCountdown < 10) {
                    finalCountdown = 0;
                    logger.debug(`[API-Single] ${lotCode} 倒计时<10秒，锁定为0（避免跳动）`);
                  }

                  data.officialCountdown = finalCountdown;
                } else if (sourceConfig?.countdownBehavior === 'wait_for_zero') {
                  // ✅ SpeedyLot88彩种：优先使用CountdownManager的倒计时值
                  // 策略：CountdownManager通过tick()每秒递减，消除跳变，与WebSocket保持一致
                  // Fallback：如果CountdownManager没有数据，使用爬虫返回的实时倒计时

                  let finalCountdown;
                  const countdownState = this.countdownManager?.getState(lotCode);

                  if (countdownState && countdownState.countdown !== undefined) {
                    // 优先使用CountdownManager的倒计时值
                    finalCountdown = countdownState.countdown;
                    logger.debug(
                      `[API-Single] ${lotCode} 极速彩使用CountdownManager倒计时: ${finalCountdown}秒 ` +
                      `(period=${countdownState.period})`
                    );
                  } else if (rtData.officialCountdown !== undefined) {
                    // Fallback 1: 使用爬虫返回的实时倒计时（已含+13秒校正）
                    finalCountdown = rtData.officialCountdown;
                    logger.warn(
                      `[API-Single] ${lotCode} CountdownManager无数据，使用爬虫实时值: ${finalCountdown}秒 (已含+13秒校正)`
                    );
                  } else {
                    // Fallback 2: 如果爬虫没有返回倒计时，使用数据库时间计算
                    const drawInterval = sourceConfig?.drawInterval || 75;
                    const earlyFetch = sourceConfig?.earlyFetch || 0;

                    // ✅ 恢复原逻辑：优先使用draw_time
                    // 原因：之前优先created_at导致SG彩种倒计时偏慢30秒
                    // 🔧 修复：Fallback时不应该加earlyFetch，否则倒计时会慢earlyFetch秒
                    // earlyFetch只用于调度器提前查询，不影响前端显示的倒计时
                    if (data.draw_time) {
                      const lastDrawTime = new Date(data.draw_time).getTime() / 1000;
                      const elapsed = currentTime - lastDrawTime;
                      const calculatedCountdown = Math.max(0, drawInterval - elapsed);
                      finalCountdown = Math.round(calculatedCountdown);
                    } else if (data.created_at) {
                      const lastDrawTime = new Date(data.created_at).getTime() / 1000;
                      const elapsed = currentTime - lastDrawTime;
                      const calculatedCountdown = Math.max(0, drawInterval - elapsed);
                      finalCountdown = Math.round(calculatedCountdown);
                    } else {
                      finalCountdown = 0;
                    }

                    logger.warn(
                      `[API-Single] ${lotCode} Fallback2倒计时: ${finalCountdown}秒 (基于数据库时间计算)`
                    );
                  }

                  // 设置最终倒计时值
                  data.officialCountdown = finalCountdown;
                } else {
                  // 🎯 台湾彩票特殊处理：使用 drawSchedule 配置实时计算倒计时
                  if (lotCode.startsWith('1000') && lotteryConfig?.drawSchedule?.mode === 'scheduled') {
                    const { drawDays, drawTime } = lotteryConfig.drawSchedule;
                    const now = new Date();
                    const currentDayOfWeek = now.getDay();
                    const [drawHour, drawMinute] = drawTime.split(':').map(Number);

                    // 找到下一个开奖日
                    let daysUntilNextDraw = null;
                    for (let i = 0; i <= 7; i++) {
                      const checkDay = (currentDayOfWeek + i) % 7;
                      if (drawDays.includes(checkDay)) {
                        if (i === 0) {
                          const currentHours = now.getHours();
                          const currentMinutes = now.getMinutes();
                          const currentTotalMinutes = currentHours * 60 + currentMinutes;
                          const drawTotalMinutes = drawHour * 60 + drawMinute;
                          if (currentTotalMinutes >= drawTotalMinutes + 10) {
                            continue; // 今天的开奖已过（给10分钟缓冲）
                          }
                        }
                        daysUntilNextDraw = i;
                        break;
                      }
                    }

                    if (daysUntilNextDraw !== null) {
                      const nextDrawTime = new Date(now);
                      nextDrawTime.setDate(nextDrawTime.getDate() + daysUntilNextDraw);
                      nextDrawTime.setHours(drawHour);
                      nextDrawTime.setMinutes(drawMinute);
                      nextDrawTime.setSeconds(0);
                      nextDrawTime.setMilliseconds(0);

                      data.officialCountdown = Math.max(0, Math.floor((nextDrawTime.getTime() - now.getTime()) / 1000));
                      logger.debug(`[API-Single] ${lotCode} 台湾彩票倒计时: ${data.officialCountdown}秒 (下次开奖: ${nextDrawTime.toLocaleString('zh-CN')})`);
                    } else {
                      data.officialCountdown = rtData.officialCountdown || 0;
                    }
                  } else {
                    // 使用原始倒计时（幸运时时彩走这个分支）
                    data.officialCountdown = rtData.officialCountdown;
                    if (lotCode === '40001') {
                      logger.debug(`[API] 幸运时时彩 使用官方倒计时: ${rtData.officialCountdown}秒`);
                    }
                  }
                }
              }
            } catch (error) {
              logger.debug(`获取倒计时失败: ${lotCode}`, error.message);
            }
          }

          // 🎯 字段名转换：下划线 → 驼峰命名
          if (data) {
            // special_numbers → specialNumbers
            if (data.special_numbers) {
              data.specialNumbers = data.special_numbers.split(',');
              delete data.special_numbers;
            }

            // draw_time → drawTime
            if (data.draw_time) {
              data.drawTime = data.draw_time;
              logger.debug(`[API] ${lotCode} 添加drawTime字段: ${data.drawTime}`);
            }
          }

          res.json({
            success: true,
            data: data || null
          });
        } else {
          // 使用批量查询获取所有彩种的最新数据
          const enabledLotteries = lotteryConfigManager.getEnabledLotteries();
          const lotCodes = enabledLotteries.map(c => c.lotCode);
          const results = await database.getAllLatestData(lotCodes);

          // 合并彩种名称
          let enrichedResults = results.map(row => {
            const config = enabledLotteries.find(c => c.lotCode === row.lot_code);
            return {
              lotCode: row.lot_code,
              name: config ? config.name : row.lot_code,
              issue: row.issue,
              drawCode: row.draw_code,
              specialNumbers: row.special_numbers ? row.special_numbers.split(',') : null,  // 🎯 台湾宾果宾果超级奖号
              drawTime: row.draw_time,
              unixtime: row.unixtime,  // 🎯 SG/AU/UK彩种的Unix时间戳，用于精确倒计时计算
              createdAt: row.created_at,  // 添加 created_at 用于倒计时计算
              updatedAt: row.updated_at,
              officialCountdown: null,  // 初始化倒计时字段
              tags: config?.tags || [],  // 🏷️ 返回彩种标签
              source: config?.source  // 返回数据源
            };
          });

          // 如果需要倒计时，并发获取所有彩种的实时倒计时
          if (shouldIncludeCountdown) {
            try {
              const currentTime = Math.floor(Date.now() / 1000); // 当前Unix时间戳（秒）

              const countdownPromises = enrichedResults.map(async (row) => {
                try {
                  // 🎯 所有彩种优化：优先使用CountdownManager，避免重新爬取（扩展到41个彩种）
                  // 原因：fetchLotteryData()会重新计算倒计时，导致与CountdownManager的tick值不一致，产生跳变
                  const countdownState = this.countdownManager?.getState(row.lotCode);
                  if (countdownState && countdownState.countdown !== undefined) {
                    row.officialCountdown = countdownState.countdown;
                    logger.debug(
                      `[API-Batch] ${row.lotCode} 直接使用CountdownManager: ${countdownState.countdown}秒 (period=${countdownState.period})`
                    );
                    return row;
                  }

                  // 🔄 CountdownManager无数据（首次启动或新彩种）：正常爬取数据
                  const realtimeData = await multiSourceDataManager.fetchLotteryData(row.lotCode);

                  // 🧹 调试日志已移除（SG彩种监控已完成）

                  if (realtimeData && realtimeData.success && realtimeData.data) {
                    // 🔧 重新计算倒计时，避免缓存导致的时间偏差
                    const data = realtimeData.data;
                    const lotteryConfig = lotteryConfigManager.getLottery(row.lotCode);
                    // 🎯 获取数据源配置（包含彩种特定的drawInterval）
                    const sourceConfig = officialSourceManager.getSourceForLottery(row.lotCode);

                    // 如果有unixtime字段（AU彩种、UK Lottos），使用与官网一致的固定间隔算法
                    if (data.unixtime) {
                      // 🎯 统一策略：所有彩种优先使用CountdownManager（扩展到41个彩种）
                      // 原因：CountdownManager每秒tick递减，与WebSocket完全一致，避免跳变
                      let finalCountdown;
                      const countdownState = this.countdownManager?.getState(row.lotCode);
                      if (countdownState && countdownState.countdown !== undefined) {
                        // ✅ 优先：使用CountdownManager（内存值，零延迟，完全一致）
                        finalCountdown = countdownState.countdown;
                        logger.debug(
                          `[API-Batch] ${row.lotCode} 使用CountdownManager: ${finalCountdown}秒 ` +
                          `(period=${countdownState.period})`
                        );
                      } else {
                        // ⚠️ Fallback：CountdownManager无数据，基于unixtime计算
                        const drawInterval = sourceConfig?.drawInterval || 300; // 默认5分钟
                        const earlyFetch = sourceConfig?.earlyFetch || 0; // 🚀 提前获取数据的秒数（SG=22秒，AU=-9秒~0秒，UK=19秒）
                        const timeElapsed = currentTime - data.unixtime;
                        const rawCountdown = drawInterval - timeElapsed;

                        // 🛡️ immediate_draw彩种（AU/UK）：保护未来时间
                        if (rawCountdown > drawInterval) {
                          // AU/UK检测到未来时间：计算真实倒计时到下一期
                          const nextDrawTime = data.unixtime + drawInterval;
                          finalCountdown = Math.max(0, nextDrawTime - currentTime);
                          logger.info(
                            `[API-Batch] ${row.lotCode} 未来时间，计算真实倒计时: ${finalCountdown}秒 ` +
                            `(nextDraw=${nextDrawTime}, current=${currentTime})`
                          );
                        } else {
                          // 倒计时计算
                          finalCountdown = Math.max(0, rawCountdown);
                          logger.debug(`[API-Batch] ${row.lotCode} 使用unixtime计算: ${finalCountdown}秒`);
                        }
                      }

                      // 🔧 AU彩种特殊处理：倒计时<10秒时锁定为0，避免新旧期号切换时跳动
                      if (row.lotCode.startsWith('300') && finalCountdown > 0 && finalCountdown < 10) {
                        finalCountdown = 0;
                        logger.debug(`[API-Batch] ${row.lotCode} 倒计时<10秒，锁定为0（避免跳动）`);
                      }

                      row.officialCountdown = finalCountdown;
                    } else if (sourceConfig?.countdownBehavior === 'wait_for_zero') {
                      // ✅ SpeedyLot88彩种：优先使用CountdownManager的倒计时值
                      // 策略：CountdownManager通过tick()每秒递减，消除跳变，与WebSocket保持一致
                      // Fallback：如果CountdownManager没有数据，使用爬虫返回的实时倒计时

                      let finalCountdown;
                      const countdownState = this.countdownManager?.getState(row.lotCode);

                      if (countdownState && countdownState.countdown !== undefined) {
                        // 优先使用CountdownManager的倒计时值
                        finalCountdown = countdownState.countdown;
                        logger.debug(
                          `[API-Batch] ${row.lotCode} 极速彩使用CountdownManager倒计时: ${finalCountdown}秒 ` +
                          `(period=${countdownState.period})`
                        );
                      } else if (data.officialCountdown !== undefined) {
                        // Fallback 1: 使用爬虫返回的实时倒计时（已含+13秒校正）
                        finalCountdown = data.officialCountdown;
                        logger.warn(
                          `[API-Batch] ${row.lotCode} CountdownManager无数据，使用爬虫实时值: ${finalCountdown}秒 (已含+13秒校正)`
                        );
                      } else {
                        // Fallback 2: 如果爬虫没有返回倒计时，使用数据库时间计算
                        const drawInterval = sourceConfig?.drawInterval || 75;
                        const earlyFetch = sourceConfig?.earlyFetch || 0;

                        // ✅ 恢复原逻辑：优先使用draw_time
                        // 原因：之前优先created_at导致SG彩种倒计时偏慢30秒
                        // 🔧 修复：Fallback时不应该加earlyFetch，否则倒计时会慢earlyFetch秒
                        // earlyFetch只用于调度器提前查询，不影响前端显示的倒计时
                        if (row.drawTime) {
                          const lastDrawTime = new Date(row.drawTime).getTime() / 1000;
                          const elapsed = currentTime - lastDrawTime;
                          const calculatedCountdown = Math.max(0, drawInterval - elapsed);
                          finalCountdown = Math.round(calculatedCountdown);
                        } else if (row.createdAt) {
                          const lastDrawTime = new Date(row.createdAt).getTime() / 1000;
                          const elapsed = currentTime - lastDrawTime;
                          const calculatedCountdown = Math.max(0, drawInterval - elapsed);
                          finalCountdown = Math.round(calculatedCountdown);
                        } else {
                          finalCountdown = 0;
                        }

                        logger.warn(
                          `[API-Batch] ${row.lotCode} Fallback2倒计时: ${finalCountdown}秒 (基于数据库时间计算)`
                        );
                      }

                      // 设置最终倒计时值
                      row.officialCountdown = finalCountdown;
                    } else {
                      // 🎯 台湾彩票特殊处理：使用 drawSchedule 配置实时计算倒计时
                      if (row.lotCode.startsWith('1000') && lotteryConfig?.drawSchedule?.mode === 'scheduled') {
                        const { drawDays, drawTime } = lotteryConfig.drawSchedule;
                        const now = new Date();
                        const currentDayOfWeek = now.getDay();
                        const [drawHour, drawMinute] = drawTime.split(':').map(Number);

                        // 找到下一个开奖日
                        let daysUntilNextDraw = null;
                        for (let i = 0; i <= 7; i++) {
                          const checkDay = (currentDayOfWeek + i) % 7;
                          if (drawDays.includes(checkDay)) {
                            if (i === 0) {
                              const currentHours = now.getHours();
                              const currentMinutes = now.getMinutes();
                              const currentTotalMinutes = currentHours * 60 + currentMinutes;
                              const drawTotalMinutes = drawHour * 60 + drawMinute;
                              if (currentTotalMinutes >= drawTotalMinutes + 10) {
                                continue; // 今天的开奖已过（给10分钟缓冲）
                              }
                            }
                            daysUntilNextDraw = i;
                            break;
                          }
                        }

                        if (daysUntilNextDraw !== null) {
                          const nextDrawTime = new Date(now);
                          nextDrawTime.setDate(nextDrawTime.getDate() + daysUntilNextDraw);
                          nextDrawTime.setHours(drawHour);
                          nextDrawTime.setMinutes(drawMinute);
                          nextDrawTime.setSeconds(0);
                          nextDrawTime.setMilliseconds(0);

                          row.officialCountdown = Math.max(0, Math.floor((nextDrawTime.getTime() - now.getTime()) / 1000));
                          logger.debug(`[API-Batch] ${row.lotCode} 台湾彩票倒计时: ${row.officialCountdown}秒 (下次开奖: ${nextDrawTime.toLocaleString('zh-CN')})`);
                        } else {
                          row.officialCountdown = data.officialCountdown || 0;
                        }
                      } else {
                        // 使用原始倒计时
                        row.officialCountdown = data.officialCountdown;
                      }
                    }
                  }
                } catch (error) {
                  logger.debug(`获取倒计时失败: ${row.lotCode}`, error.message);
                }
                return row;
              });

              enrichedResults = await Promise.all(countdownPromises);
            } catch (error) {
              logger.error('批量获取倒计时失败', error);
            }
          }

          // ⚡ 更新缓存（仅在批量查询时）
          latestDataCache = enrichedResults;
          latestDataCacheTime = Date.now();

          res.json({
            success: true,
            data: enrichedResults,
            total: enrichedResults.length,
            cached: false
          });
        }
      } catch (error) {
        logger.error('获取最新数据失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 获取历史数据（支持多数据源）
    this.app.get('/api/history-data', async (req, res) => {
      try {
        const { lotCode, pageNo, pageSize, date, year } = req.query;
        logger.info(`[Web] 📊 历史数据查询请求: lotCode=${lotCode}, date=${date}, year=${year}, pageNo=${pageNo}, pageSize=${pageSize}`);

        if (!lotCode) {
          return res.status(400).json({
            success: false,
            error: '缺少彩种代码参数'
          });
        }

        // 获取彩种配置
        const lotteryConfig = lotteryConfigManager.getLottery(lotCode);
        const name = lotteryConfig ? lotteryConfig.name : lotCode;
        const source = lotteryConfig ? lotteryConfig.source : null;
        const scraperKey = lotteryConfigManager.getScraperKey(lotCode);

        if (!lotteryConfig) {
          return res.status(400).json({
            success: false,
            error: '不支持的彩种'
          });
        }

        let records = [];

        // 🎯 HKJC特殊处理：按年份查询
        if (source === 'hkjc' && year) {
          logger.info(`[Web] 📊 查询HKJC历史数据: ${name} (${lotCode}) - ${year}年`);

          // 先从数据库查询该年份的数据
          const yearStart = `${year}-01-01`;
          const yearEnd = `${year}-12-31 23:59:59`; // 🔧 修复：包含当天23:59:59之前的所有记录

          const pool = database._initPool();
          const [dbYearRecords] = await pool.query(
            `SELECT * FROM lottery_results
             WHERE lot_code = ?
             AND draw_time >= ?
             AND draw_time <= ?
             ORDER BY draw_time DESC`,
            [lotCode, yearStart, yearEnd]
          );

          if (dbYearRecords && dbYearRecords.length > 0) {
            logger.info(`[Web] 📊 HKJC ${year}年 数据库已有数据，直接返回 (${dbYearRecords.length}期)`);

            // 手动分页
            const page = parseInt(pageNo) || 1;
            const size = parseInt(pageSize) || dbYearRecords.length;
            const start = (page - 1) * size;
            const end = start + size;
            const paginatedRecords = dbYearRecords.slice(start, end);

            // 🎯 为每条记录添加source字段
            const recordsWithSource = paginatedRecords.map(record => ({
              ...record,
              source: source || 'database'
            }));

            return res.json({
              success: true,
              data: {
                lotCode,
                name,
                records: recordsWithSource,
                total: dbYearRecords.length,
                pageNo: page,
                pageSize: size,
                totalPages: Math.ceil(dbYearRecords.length / size)
              },
              message: `数据来自数据库 (${year}年)`
            });
          }

          // 数据库没有数据，从CPZhan爬取该年份数据
          logger.info(`[Web] 📊 HKJC ${year}年 数据库无数据，从CPZhan爬取`);

          try {
            const CPZhanHistoryScraper = (await import('../scrapers/CPZhanHistoryScraper.js')).default;
            const cpzhanScraper = new CPZhanHistoryScraper();
            const yearData = await cpzhanScraper.fetchYearData(year);

            if (!yearData || yearData.length === 0) {
              return res.json({
                success: true,
                data: {
                  lotCode,
                  name,
                  records: [],
                  total: 0,
                  pageNo: 1,
                  pageSize: parseInt(pageSize) || 50,
                  totalPages: 0
                },
                message: `${year}年暂无数据`
              });
            }

            // 异步保存到数据库
            setImmediate(async () => {
              try {
                const dbRecords = yearData.map(record => ({
                  issue: record.period,
                  drawCode: record.opencode,  // ✅ 只保存正码，不合并特码
                  specialNumbers: record.extra ? [record.extra] : [],  // ✅ 特码单独存储
                  drawTime: record.opentime
                }));

                await database.saveHistoryData(lotCode, dbRecords, {
                  replaceExisting: false,
                  date: null
                });
                logger.info(`[Web] ✅ HKJC ${year}年历史数据已保存: ${yearData.length}期`);
              } catch (error) {
                logger.error(`[Web] HKJC ${year}年数据保存失败: ${error.message}`);
              }
            });

            // 手动分页
            const page = parseInt(pageNo) || 1;
            const size = parseInt(pageSize) || yearData.length;
            const start = (page - 1) * size;
            const end = start + size;
            const paginatedRecords = yearData.slice(start, end);

            return res.json({
              success: true,
              data: {
                lotCode,
                name,
                records: paginatedRecords.map(r => ({
                  issue: r.period,
                  draw_code: r.opencode,  // ✅ 只返回正码
                  extra: r.extra,  // ✅ 特码单独返回
                  draw_time: r.opentime,
                  lot_code: lotCode
                })),
                total: yearData.length,
                pageNo: page,
                pageSize: size,
                totalPages: Math.ceil(yearData.length / size)
              },
              message: `${year}年数据 (共${yearData.length}期)`
            });

          } catch (error) {
            logger.error(`[Web] HKJC ${year}年数据获取失败: ${error.message}`);
            return res.status(500).json({
              success: false,
              error: `获取${year}年数据失败: ${error.message}`
            });
          }
        }

        // 🎯 CWL福彩特殊处理：按年份查询
        if (source === 'cwl' && year) {
          logger.info(`[Web] 📊 查询福彩历史数据: ${name} (${lotCode}) - ${year}年`);

          // 从数据库查询该年份的数据
          const yearStart = `${year}-01-01`;
          const yearEnd = `${year}-12-31 23:59:59`;

          const pool = database._initPool();
          const [dbYearRecords] = await pool.query(
            `SELECT * FROM lottery_results
             WHERE lot_code = ?
             AND draw_time >= ?
             AND draw_time <= ?
             ORDER BY draw_time DESC`,
            [lotCode, yearStart, yearEnd]
          );

          // 🎯 智能完整性检测：判断数据是否完整
          const expectedCounts = {
            '70001': 149,  // 双色球
            '70002': 352,  // 福彩3D
            '70003': 149,  // 七乐彩
            '70004': 352   // 快乐8
          };
          const expectedCount = expectedCounts[lotCode] || 100;
          const isComplete = dbYearRecords && dbYearRecords.length >= expectedCount * 0.9; // 90%阈值

          if (isComplete) {
            logger.info(`[Web] 📊 福彩 ${year}年 数据完整，直接返回 (${dbYearRecords.length}期)`);

            // 手动分页
            const page = parseInt(pageNo) || 1;
            const size = parseInt(pageSize) || dbYearRecords.length;
            const start = (page - 1) * size;
            const end = start + size;
            const paginatedRecords = dbYearRecords.slice(start, end);

            // 🎯 为每条记录添加source字段
            const recordsWithSource = paginatedRecords.map(record => ({
              ...record,
              source: source || 'database'
            }));

            return res.json({
              success: true,
              data: {
                lotCode,
                name,
                records: recordsWithSource,
                total: dbYearRecords.length,
                pageNo: page,
                pageSize: size,
                totalPages: Math.ceil(dbYearRecords.length / size)
              },
              message: `数据来自数据库 (${year}年)`
            });
          } else {
            // 数据不完整或为空，自动从API获取并补全
            const status = dbYearRecords && dbYearRecords.length > 0
              ? `数据不完整(${dbYearRecords.length}/${expectedCount}期)`
              : '数据库无数据';
            logger.info(`[Web] 📊 福彩 ${year}年 ${status}，自动从API补全`);

            try {
              // 根据lotCode确定scraperKey
              const scraperKeyMap = {
                '70001': 'ssq',    // 双色球
                '70002': 'fc3d',   // 福彩3D
                '70003': 'qlc',    // 七乐彩
                '70004': 'kl8'     // 快乐8
              };
              const scraperKey = scraperKeyMap[lotCode];

              if (!scraperKey) {
                throw new Error(`不支持的福彩彩种: ${lotCode}`);
              }

              // 从CWLFreeScraper获取完整年度历史数据（多次查询自动合并）
              const CWLFreeScraper = (await import('../scrapers/CWLFreeScraper.js')).default;
              const result = await CWLFreeScraper.fetchFullYearData(scraperKey, parseInt(year));

              if (!result || !result.yearData || result.yearData.length === 0) {
                return res.json({
                  success: true,
                  data: {
                    lotCode,
                    name,
                    records: [],
                    total: 0,
                    pageNo: 1,
                    pageSize: parseInt(pageSize) || 50,
                    totalPages: 0
                  },
                  message: `${year}年暂无数据`
                });
              }

              const { allData, yearData } = result;

              // 异步保存到数据库（保存所有数据，不只是当年的）
              setImmediate(async () => {
                try {
                  const dbRecords = allData.map(record => ({
                    issue: record.period,
                    drawCode: record.opencode,
                    drawTime: record.opentime
                  }));

                  await database.saveHistoryData(lotCode, dbRecords, {
                    replaceExisting: false
                  });
                  logger.info(`[Web] ✅ 福彩 ${name} 历史数据已自动保存: ${allData.length}期 (查询${year}年返回${yearData.length}期)`);
                } catch (error) {
                  logger.error(`[Web] 福彩 ${name} 数据保存失败: ${error.message}`);
                }
              });

              // 手动分页（只返回指定年份的数据）
              const page = parseInt(pageNo) || 1;
              const size = parseInt(pageSize) || yearData.length;
              const start = (page - 1) * size;
              const end = start + size;
              const paginatedRecords = yearData.slice(start, end);

              return res.json({
                success: true,
                data: {
                  lotCode,
                  name,
                  records: paginatedRecords.map(r => ({
                    issue: r.period,
                    draw_code: r.opencode,
                    draw_time: r.opentime,
                    lot_code: lotCode
                  })),
                  total: yearData.length,
                  pageNo: page,
                  pageSize: size,
                  totalPages: Math.ceil(yearData.length / size)
                },
                message: `${year}年数据 (共${yearData.length}期，已自动从API获取并保存${allData.length}期)`
              });

            } catch (error) {
              logger.error(`[Web] 福彩 ${year}年数据获取失败: ${error.message}`);
              return res.status(500).json({
                success: false,
                error: `获取${year}年数据失败: ${error.message}`
              });
            }
          }
        }

        // 🎯 体彩特殊处理：按年份查询
        if (source === 'sportslottery' && year) {
          logger.info(`[Web] 📊 查询体彩历史数据: ${name} (${lotCode}) - ${year}年`);

          // 从数据库查询该年份的数据
          const yearStart = `${year}-01-01`;
          const yearEnd = `${year}-12-31 23:59:59`;

          const pool = database._initPool();
          const [dbYearRecords] = await pool.query(
            `SELECT * FROM lottery_results
             WHERE lot_code = ?
             AND draw_time >= ?
             AND draw_time <= ?
             ORDER BY draw_time DESC`,
            [lotCode, yearStart, yearEnd]
          );

          // 🎯 智能完整性检测：判断数据是否完整
          const expectedCounts = {
            '80001': 149,  // 超级大乐透 (每周3次)
            '80002': 350,  // 排列3 (每天)
            '80003': 350,  // 排列5 (每天)
            '80004': 151   // 七星彩 (每周3次)
          };
          const expectedCount = expectedCounts[lotCode] || 100;
          const isComplete = dbYearRecords && dbYearRecords.length >= expectedCount * 0.9; // 90%阈值

          if (isComplete) {
            logger.info(`[Web] 📊 体彩 ${year}年 数据完整，直接返回 (${dbYearRecords.length}期)`);

            // 手动分页
            const page = parseInt(pageNo) || 1;
            const size = parseInt(pageSize) || dbYearRecords.length;
            const start = (page - 1) * size;
            const end = start + size;
            const paginatedRecords = dbYearRecords.slice(start, end);

            // 🎯 为每条记录添加source字段
            const recordsWithSource = paginatedRecords.map(record => ({
              ...record,
              source: source || 'database'
            }));

            return res.json({
              success: true,
              data: {
                lotCode,
                name,
                records: recordsWithSource,
                total: dbYearRecords.length,
                pageNo: page,
                pageSize: size,
                totalPages: Math.ceil(dbYearRecords.length / size)
              },
              message: `数据来自数据库 (${year}年)`
            });
          } else {
            // 数据不完整或为空，自动从API获取并补全
            const status = dbYearRecords && dbYearRecords.length > 0
              ? `数据不完整(${dbYearRecords.length}/${expectedCount}期)`
              : '数据库无数据';
            logger.info(`[Web] 📊 体彩 ${year}年 ${status}，自动从API补全`);

            try {
              // 从SportsLotteryScraper获取该年度历史数据
              const SportsLotteryScraper = (await import('../scrapers/SportsLotteryScraper.js')).default;
              const sportsLotteryScraper = new SportsLotteryScraper();
              const yearData = await sportsLotteryScraper.fetchHistoryData(lotCode, { year });

              if (!yearData || yearData.length === 0) {
                return res.json({
                  success: true,
                  data: {
                    lotCode,
                    name,
                    records: [],
                    total: 0,
                    pageNo: 1,
                    pageSize: parseInt(pageSize) || 50,
                    totalPages: 0
                  },
                  message: `${year}年暂无数据`
                });
              }

              // 异步保存到数据库
              setImmediate(async () => {
                try {
                  const dbRecords = yearData.map(record => ({
                    issue: record.period,
                    drawCode: record.opencode,
                    drawTime: record.drawTime
                  }));

                  await database.saveHistoryData(lotCode, dbRecords, {
                    replaceExisting: false
                  });
                  logger.info(`[Web] ✅ 体彩 ${name} 历史数据已自动保存: ${yearData.length}期`);
                } catch (error) {
                  logger.error(`[Web] 体彩 ${name} 数据保存失败: ${error.message}`);
                }
              });

              // 手动分页
              const page = parseInt(pageNo) || 1;
              const size = parseInt(pageSize) || yearData.length;
              const start = (page - 1) * size;
              const end = start + size;
              const paginatedRecords = yearData.slice(start, end);

              return res.json({
                success: true,
                data: {
                  lotCode,
                  name,
                  records: paginatedRecords.map(r => ({
                    issue: r.period,
                    draw_code: r.opencode,
                    draw_time: r.drawTime,
                    lot_code: lotCode
                  })),
                  total: yearData.length,
                  pageNo: page,
                  pageSize: size,
                  totalPages: Math.ceil(yearData.length / size)
                },
                message: `${year}年数据 (共${yearData.length}期，已自动从API获取并保存)`
              });

            } catch (error) {
              logger.error(`[Web] 体彩 ${year}年数据获取失败: ${error.message}`);
              return res.status(500).json({
                success: false,
                error: `获取${year}年数据失败: ${error.message}`
              });
            }
          }
        }

        // 🎯 台湾宾果宾果特殊处理：按日期查询（每天202期，不按年查询）
        if (lotCode === '100007' && date) {
          logger.info(`[Web] 📊 查询宾果宾果历史数据: ${name} (${lotCode}) - ${date}`);

          // 从数据库查询该日期的数据
          const pool = database._initPool();
          const [dbDateRecords] = await pool.query(
            `SELECT * FROM lottery_results
             WHERE lot_code = ?
             AND DATE(draw_time) = ?
             ORDER BY draw_time DESC`,
            [lotCode, date]
          );

          logger.info(`[Web] 🔍 宾果数据库查询完成: ${date} 返回${dbDateRecords ? dbDateRecords.length : 0}条记录`);

          // 宾果每天约202期，如果数据少于180期认为不完整，自动补全
          const expectedPerDay = 202;
          const actualCount = dbDateRecords ? dbDateRecords.length : 0;
          const threshold = 0.9; // 90%阈值
          const isComplete = actualCount >= expectedPerDay * threshold;

          logger.info(`[Web] 🔍 宾果 ${date} 数据检查: ${actualCount}/${expectedPerDay}期 (${(actualCount/expectedPerDay*100).toFixed(1)}%) - ${isComplete ? '✅完整' : '❌不完整，自动补全'}`);

          if (isComplete) {
            // 数据完整，直接返回
            const page = parseInt(pageNo) || 1;
            const size = parseInt(pageSize) || dbDateRecords.length;
            const start = (page - 1) * size;
            const end = start + size;
            const paginatedRecords = dbDateRecords.slice(start, end);

            // 🎯 为每条记录添加source字段
            const recordsWithSource = paginatedRecords.map(record => ({
              ...record,
              source: source || 'database'
            }));

            return res.json({
              success: true,
              data: {
                lotCode,
                name,
                records: recordsWithSource,
                total: dbDateRecords.length,
                pageNo: page,
                pageSize: size,
                totalPages: Math.ceil(dbDateRecords.length / size)
              },
              message: `数据来自数据库 (${date}，${dbDateRecords.length}期)`
            });
          } else {
            // 数据不完整，从API获取
            logger.info(`[Web] 📊 宾果 ${date} 数据不完整，从API获取`);

            try {
              const taiwanBingoScraper = (await import('../scrapers/TaiwanBingoScraper.js')).default;
              const dateRecords = await taiwanBingoScraper.fetchHistoryData(lotCode, date);

              if (!dateRecords || dateRecords.length === 0) {
                return res.json({
                  success: true,
                  data: {
                    lotCode,
                    name,
                    records: [],
                    total: 0,
                    pageNo: 1,
                    pageSize: parseInt(pageSize) || 50,
                    totalPages: 0
                  },
                  message: `${date} 暂无数据`
                });
              }

              // 同步保存到数据库
              await database.saveHistoryData(lotCode, dateRecords, { replaceExisting: false });
              logger.info(`[Web] ✅ 宾果 ${date} 数据已保存: ${dateRecords.length}期`);

              // 按开奖时间倒序排列
              dateRecords.sort((a, b) => {
                const timeA = new Date(a.draw_time || a.drawTime).getTime();
                const timeB = new Date(b.draw_time || b.drawTime).getTime();
                return timeB - timeA;
              });

              // 手动分页
              const page = parseInt(pageNo) || 1;
              const size = parseInt(pageSize) || dateRecords.length;
              const start = (page - 1) * size;
              const end = start + size;
              const paginatedRecords = dateRecords.slice(start, end);

              return res.json({
                success: true,
                data: {
                  lotCode,
                  name,
                  records: paginatedRecords,
                  total: dateRecords.length,
                  pageNo: page,
                  pageSize: size,
                  totalPages: Math.ceil(dateRecords.length / size)
                },
                message: `${date} 数据 (共${dateRecords.length}期，已自动从API获取并保存)`
              });

            } catch (error) {
              logger.error(`[Web] 宾果 ${date} 数据获取失败: ${error.message}`);
              return res.status(500).json({
                success: false,
                error: `获取${date}数据失败: ${error.message}`
              });
            }
          }
        }

        // 🎯 台湾彩票特殊处理：按年份查询
        if (lotCode.startsWith('1000') && year) {
          logger.info(`[Web] 📊 查询台湾彩票历史数据: ${name} (${lotCode}) - ${year}年`);

          // 从数据库查询该年份的数据
          const yearStart = `${year}-01-01`;
          const yearEnd = `${year}-12-31 23:59:59`;

          const pool = database._initPool();
          logger.info(`[Web] 🔍 执行数据库查询: lotCode=${lotCode}, yearStart=${yearStart}, yearEnd=${yearEnd}`);

          const [dbYearRecords] = await pool.query(
            `SELECT * FROM lottery_results
             WHERE lot_code = ?
             AND draw_time >= ?
             AND draw_time <= ?
             ORDER BY draw_time DESC`,
            [lotCode, yearStart, yearEnd]
          );

          logger.info(`[Web] 🔍 数据库查询完成: 返回${dbYearRecords ? dbYearRecords.length : 0}条记录`);
          if (dbYearRecords && dbYearRecords.length > 0) {
            logger.info(`[Web] 📝 数据库第1条: lot_code=${dbYearRecords[0].lot_code}, issue=${dbYearRecords[0].issue}, draw_time=${dbYearRecords[0].draw_time}`);
          }

          // 🎯 智能完整性检测：判断数据是否完整
          const expectedCounts = {
            '100001': 104,  // 威力彩（每周一、四，一年约104期）
            '100002': 156,  // 大乐透（每周一、二、五，一年约156期）
            '100003': 365,  // 今彩539（每天开奖）
            '100005': 365,  // 3D/三星彩（每天开奖）
            '100006': 365,  // 4D/四星彩（每天开奖）
            '100007': 73730, // 宾果宾果（每5分钟一期，每天约202期，一年约73730期）
            '100008': 312,  // 39选5（每周一至六开奖，一年约312期）
            '100009': 312   // 49选6（每周一至六开奖，一年约312期）
          };
          const expectedCount = expectedCounts[lotCode] || 100;
          const actualCount = dbYearRecords ? dbYearRecords.length : 0;

          // 🎯 智能完整性判断
          const currentYear = new Date().getFullYear();
          const currentMonth = new Date().getMonth() + 1; // 1-12
          const currentDay = new Date().getDate();
          let isComplete = false;
          let checkReason = '';

          if (actualCount === 0) {
            isComplete = false;
            checkReason = '数据库无数据';
          } else if (parseInt(year) === currentYear) {
            // 当前年份：检查是否需要补全历史月份数据
            // 每天开奖的彩种（今彩539、3星彩、4星彩、39樂合彩）
            const dailyLotteries = ['100003', '100005', '100006', '100008'];

            if (dailyLotteries.includes(lotCode)) {
              // 计算当前应该有的期数（从1月1日到昨天）
              const dayOfYear = Math.floor((new Date() - new Date(currentYear, 0, 0)) / (1000 * 60 * 60 * 24));
              const expectedDailyCount = Math.max(1, dayOfYear - 1); // 昨天之前的所有期数（排除今天）

              // 如果实际期数少于预期的80%，触发补全
              if (actualCount < expectedDailyCount * 0.8) {
                isComplete = false;
                checkReason = `当前年份第${dayOfYear}天，数据库${actualCount}期 < 预期${expectedDailyCount}期的80%，需要补全`;
              } else {
                isComplete = true;
                checkReason = `当前年份，数据库有${actualCount}期数据（预期≈${expectedDailyCount}期）`;
              }
            } else {
              // 非每天开奖的彩种（威力彩、大乐透、49樂合彩）：只要有数据就认为完整
              isComplete = true;
              checkReason = `当前年份，数据库有${actualCount}期数据（调度器自动采集）`;
            }
          } else {
            // 历史年份：检查最后一期是否是12月底
            const lastRecord = dbYearRecords[0]; // 已按时间倒序
            if (lastRecord && lastRecord.draw_time) {
              const lastDate = new Date(lastRecord.draw_time);
              const lastMonth = lastDate.getMonth() + 1; // 0-based
              const lastDay = lastDate.getDate();

              // 如果最后一期在12月25日之后，认为年份已完整
              if (lastMonth === 12 && lastDay >= 25) {
                isComplete = true;
                checkReason = `最后一期${lastRecord.draw_time}在12月底，认为年份完整(${actualCount}期)`;
              } else {
                // 否则使用90%阈值
                const threshold = 0.9;
                isComplete = actualCount >= expectedCount * threshold;
                checkReason = `历史年份，${actualCount}期 ${isComplete?'>=':'<'} ${Math.floor(expectedCount * threshold)}期(${threshold*100}%阈值)`;
              }
            } else {
              // 无法判断，使用90%阈值
              const threshold = 0.9;
              isComplete = actualCount >= expectedCount * threshold;
              checkReason = `历史年份，${actualCount}期 ${isComplete?'>=':'<'} ${Math.floor(expectedCount * threshold)}期(${threshold*100}%阈值)`;
            }
          }

          logger.info(`[Web] 🔍 台湾彩票 ${name} ${year}年 数据检查: 数据库${actualCount}期 / 预期${expectedCount}期 (${(actualCount/expectedCount*100).toFixed(1)}%) - ${checkReason} - ${isComplete ? '✅完整' : '❌不完整'}`)

          if (isComplete) {
            logger.info(`[Web] 📊 台湾彩票 ${year}年 数据完整，直接返回 (${dbYearRecords.length}期)`);

            // 手动分页
            const page = parseInt(pageNo) || 1;
            const size = parseInt(pageSize) || dbYearRecords.length;
            const start = (page - 1) * size;
            const end = start + size;
            const paginatedRecords = dbYearRecords.slice(start, end);

            // 🎯 为每条记录添加source字段
            const recordsWithSource = paginatedRecords.map(record => ({
              ...record,
              source: source || 'database'
            }));

            return res.json({
              success: true,
              data: {
                lotCode,
                name,
                records: recordsWithSource,
                total: dbYearRecords.length,
                pageNo: page,
                pageSize: size,
                totalPages: Math.ceil(dbYearRecords.length / size)
              },
              message: `数据来自数据库 (${year}年)`
            });
          } else {
            // 数据不完整或为空，自动从API获取并补全
            const status = dbYearRecords && dbYearRecords.length > 0
              ? `数据不完整(${dbYearRecords.length}/${expectedCount}期)`
              : '数据库无数据';
            logger.info(`[Web] 📊 台湾彩票 ${year}年 ${status}，自动从API补全`);

            try {
              // 🎯 根据彩种选择对应的爬虫
              const allYearRecords = [];

              if (lotCode === '100007') {
                // 🎰 宾果宾果：使用专用爬虫，按日期获取数据
                const taiwanBingoScraper = (await import('../scrapers/TaiwanBingoScraper.js')).default;

                // 逐月获取该年份的数据（宾果也可以按年月查询）
                for (let month = 1; month <= 12; month++) {
                  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
                  logger.info(`[Web] 📊 获取宾果宾果 ${year}年${month}月数据 (yearMonth=${yearMonth})`);

                  try {
                    const monthData = await taiwanBingoScraper.fetchHistoryData(lotCode, yearMonth);
                    if (monthData && monthData.length > 0) {
                      allYearRecords.push(...monthData);
                      logger.info(`[Web] ✅ 宾果宾果 ${year}年${month}月: ${monthData.length}期`);
                    } else {
                      logger.info(`[Web] ⚠️ 宾果宾果 ${year}年${month}月: 无数据`);
                    }
                  } catch (monthError) {
                    logger.error(`[Web] ❌ 宾果宾果 ${year}年${month}月获取失败: ${monthError.message}`);
                  }

                  // 等待一下，避免请求过快
                  await new Promise(resolve => setTimeout(resolve, 200));
                }
              } else if (lotCode === '100008') {
                // 🎰 台湾39选5：使用专用爬虫
                const taiwan39M5Scraper = (await import('../scrapers/Taiwan39M5Scraper.js')).default;

                // 逐月获取该年份的数据
                for (let month = 1; month <= 12; month++) {
                  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
                  logger.info(`[Web] 📊 获取台湾39选5 ${year}年${month}月数据 (yearMonth=${yearMonth})`);

                  try {
                    const monthData = await taiwan39M5Scraper.fetchHistoryData(lotCode, yearMonth);
                    if (monthData && monthData.length > 0) {
                      allYearRecords.push(...monthData);
                      logger.info(`[Web] ✅ 台湾39选5 ${year}年${month}月: ${monthData.length}期`);
                    } else {
                      logger.info(`[Web] ⚠️ 台湾39选5 ${year}年${month}月: 无数据`);
                    }
                  } catch (monthError) {
                    logger.error(`[Web] ❌ 台湾39选5 ${year}年${month}月获取失败: ${monthError.message}`);
                  }

                  // 等待一下，避免请求过快
                  await new Promise(resolve => setTimeout(resolve, 200));
                }
              } else if (lotCode === '100009') {
                // 🎰 台湾49选6：使用专用爬虫
                const taiwan49M6Scraper = (await import('../scrapers/Taiwan49M6Scraper.js')).default;

                // 逐月获取该年份的数据
                for (let month = 1; month <= 12; month++) {
                  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
                  logger.info(`[Web] 📊 获取台湾49选6 ${year}年${month}月数据 (yearMonth=${yearMonth})`);

                  try {
                    const monthData = await taiwan49M6Scraper.fetchHistoryData(lotCode, yearMonth);
                    if (monthData && monthData.length > 0) {
                      allYearRecords.push(...monthData);
                      logger.info(`[Web] ✅ 台湾49选6 ${year}年${month}月: ${monthData.length}期`);
                    } else {
                      logger.info(`[Web] ⚠️ 台湾49选6 ${year}年${month}月: 无数据`);
                    }
                  } catch (monthError) {
                    logger.error(`[Web] ❌ 台湾49选6 ${year}年${month}月获取失败: ${monthError.message}`);
                  }

                  // 等待一下，避免请求过快
                  await new Promise(resolve => setTimeout(resolve, 200));
                }
              } else {
                // 其他台湾彩票：使用通用爬虫
                const taiwanScraper = (await import('../scrapers/TaiwanLotteryScraper.js')).default;

                // 逐月获取该年份的数据
                for (let month = 1; month <= 12; month++) {
                  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
                  logger.info(`[Web] 📊 获取台湾彩票 ${name} ${year}年${month}月数据 (yearMonth=${yearMonth})`);

                  try {
                    const monthData = await taiwanScraper.fetchHistoryData(lotCode, yearMonth);
                    if (monthData && monthData.length > 0) {
                      allYearRecords.push(...monthData);
                      logger.info(`[Web] ✅ ${name} ${year}年${month}月: ${monthData.length}期`);
                    } else {
                      logger.info(`[Web] ⚠️ ${name} ${year}年${month}月: 无数据`);
                    }
                  } catch (monthError) {
                    logger.error(`[Web] ❌ ${name} ${year}年${month}月获取失败: ${monthError.message}`);
                  }

                  // 等待一下，避免请求过快
                  await new Promise(resolve => setTimeout(resolve, 200));
                }
              }

              if (!allYearRecords || allYearRecords.length === 0) {
                return res.json({
                  success: true,
                  data: {
                    lotCode,
                    name,
                    records: [],
                    total: 0,
                    pageNo: 1,
                    pageSize: parseInt(pageSize) || 50,
                    totalPages: 0
                  },
                  message: `${year}年暂无数据`
                });
              }

              // 同步保存到数据库（确保后续查询能直接从数据库读取）
              try {
                logger.info(`[Web] 💾 保存台湾彩票 ${name} ${year}年数据到数据库 (${allYearRecords.length}期)`);
                // 打印第一条和最后一条记录的样本
                if (allYearRecords.length > 0) {
                  logger.info(`[Web] 📝 数据样本 - 第1条: issue=${allYearRecords[0].issue}, drawTime=${allYearRecords[0].drawTime || allYearRecords[0].draw_time}, drawCode=${allYearRecords[0].drawCode || allYearRecords[0].draw_code}`);
                  logger.info(`[Web] 📝 数据样本 - 最后1条: issue=${allYearRecords[allYearRecords.length-1].issue}, drawTime=${allYearRecords[allYearRecords.length-1].drawTime || allYearRecords[allYearRecords.length-1].draw_time}, drawCode=${allYearRecords[allYearRecords.length-1].drawCode || allYearRecords[allYearRecords.length-1].draw_code}`);
                }
                await database.saveHistoryData(lotCode, allYearRecords, { replaceExisting: false });
                logger.info(`[Web] ✅ 台湾彩票 ${name} ${year}年数据保存成功`);
              } catch (saveError) {
                logger.error(`[Web] ❌ 保存台湾彩票数据失败: ${saveError.message}`);
                logger.error(`[Web] ❌ 保存错误堆栈:`, saveError.stack);
                // 即使保存失败，仍返回数据给用户
              }

              // 按开奖时间倒序排列（最新的在前）
              allYearRecords.sort((a, b) => {
                const timeA = new Date(a.draw_time || a.drawTime).getTime();
                const timeB = new Date(b.draw_time || b.drawTime).getTime();
                return timeB - timeA;  // 倒序
              });

              // 立即返回从API获取的数据
              logger.info(`[Web] ✅ 台湾彩票 ${name} ${year}年数据获取完成 (${allYearRecords.length}期)`);

              // 手动分页
              const page = parseInt(pageNo) || 1;
              const size = parseInt(pageSize) || allYearRecords.length;
              const start = (page - 1) * size;
              const end = start + size;
              const paginatedRecords = allYearRecords.slice(start, end);

              return res.json({
                success: true,
                data: {
                  lotCode,
                  name,
                  records: paginatedRecords,
                  total: allYearRecords.length,
                  pageNo: page,
                  pageSize: size,
                  totalPages: Math.ceil(allYearRecords.length / size)
                },
                message: `${year}年数据 (共${allYearRecords.length}期，已自动从API获取并保存)`
              });

            } catch (error) {
              logger.error(`[Web] 台湾彩票 ${year}年数据获取失败: ${error.message}`);
              return res.status(500).json({
                success: false,
                error: `获取${year}年数据失败: ${error.message}`
              });
            }
          }
        }

        // 如果没有提供date参数（且不是HKJC/CWL/体彩/台湾彩票的year查询），从数据库读取最新数据
        if (!date) {
          logger.info(`[Web] 📊 查询历史数据: ${name} (${lotCode}) - 从数据库获取`);
          const page = parseInt(pageNo) || 1;
          const size = parseInt(pageSize) || 50;
          const dbRecords = await database.getHistoryData(lotCode, {
            pageNo: page,
            pageSize: size
          });

          // 🎯 为每条记录添加source字段
          const recordsWithSource = (dbRecords.records || []).map(record => ({
            ...record,
            source: source || 'database'
          }));

          return res.json({
            success: true,
            data: {
              lotCode,
              name,
              records: recordsWithSource,
              total: dbRecords.total || 0,
              pageNo: page,
              pageSize: size,
              totalPages: Math.ceil((dbRecords.total || 0) / size)
            }
          });
        }

        // 🎯 带date参数时，先查数据库，如果有数据就直接返回（快速响应）
        const dbDateRecords = await database.getHistoryData(lotCode, {
          pageNo: 1,
          pageSize: 2000,  // 获取足够多的记录（极速彩一天可能1000+期）
          date: date  // ⭐ 传入日期参数进行精确过滤
        });

        // 标记是否需要替换数据（在检测到数据不完整时设置为true）
        let needReplaceData = false;

        // 检查数据库中是否已有该日期的数据
        if (dbDateRecords.records && dbDateRecords.records.length > 0) {
          let filteredRecords = dbDateRecords.records;

          // ⭐ 特殊处理：幸运时时彩、SG彩种、幸运飞艇需要按期号前缀过滤
          // 原因：这些彩种的最后一期开奖时间可能是次日凌晨
          // 例如：20251225288期的开奖时间是2025-12-26 00:00:00
          // 幸运飞艇：销售日13:09~次日04:04，最后几期在次日凌晨
          //
          // 🔧 注意：如果彩种配置了salesDayStart/End，则跳过此过滤，因为Database.js已经正确处理
          const lotteryConfig = lotteryConfigManager.getLottery(lotCode);
          const hasSalesDayConfig = lotteryConfig?.salesDayStart && lotteryConfig?.salesDayEnd;

          if (!hasSalesDayConfig && (source === 'luckysscai' || source === 'sglotteries' || source === 'luckylottoz')) {
            const datePrefix = date.replace(/-/g, '');  // "2025-12-25" -> "20251225"

            // 🔧 修复：幸运时时彩特殊处理 - 第120期开奖在次日00:00
            if (source === 'luckysscai') {
              // 计算前一天的日期前缀
              const [year, month, day] = date.split('-').map(n => parseInt(n));
              const prevDate = new Date(year, month - 1, day - 1);
              const prevDatePrefix = prevDate.getFullYear() +
                                   String(prevDate.getMonth() + 1).padStart(2, '0') +
                                   String(prevDate.getDate()).padStart(2, '0');

              // 包含：1) 当天期号（YYYYMMDD-001到120）2) 前一天的第120期
              // 说明：当天120期虽然开奖在次日00:00，但期号属于当天
              filteredRecords = dbDateRecords.records.filter(r => {
                if (!r.issue) return false;

                // 当天的所有期号（001-120）
                if (r.issue.startsWith(datePrefix)) return true;

                // 前一天的第120期（开奖在当天00:00）
                if (r.issue === `${prevDatePrefix}-120`) return true;

                return false;
              });
            } else {
              // SG彩种和幸运飞艇保持原有逻辑
              filteredRecords = dbDateRecords.records.filter(r =>
                r.issue && r.issue.startsWith(datePrefix)
              );
            }

            // 🔍 过滤后如果没有数据，继续从官网爬取
            if (filteredRecords.length === 0) {
              logger.info(`[Web] 📊 ${name} ${date} 数据库中无该日期数据（期号过滤后为空），从官网爬取`);
              // 不return，继续执行下面的官网爬取逻辑
            }
          }

          // 🔍 数据完整性检查
          let isDataComplete = false;
          let expectedCount = 0;

          // 🔧 判断是否是今天的数据
          const today = new Date().toISOString().split('T')[0];
          const isToday = date === today;

          if (source === 'luckysscai') {
            // 幸运时时彩：每天120期（允许120-125）
            expectedCount = 120;
            isDataComplete = filteredRecords.length >= 120 && filteredRecords.length <= 125;
          } else if (source === 'speedylot88') {
            // SpeedyLot88：极速六合彩288条，其他极速系列1152条
            if (lotCode === '10098') {
              // 极速六合彩：每5分钟一期，一天288条
              expectedCount = 288;
              // 🔧 95%阈值：273条以上认为完整
              isDataComplete = filteredRecords.length >= Math.floor(288 * 0.95);
            } else {
              // 其他极速系列：一天1152条
              expectedCount = 1152;
              // 🔧 如果是今天，只要有数据就认为完整（因为今天还在进行中）
              if (isToday) {
                isDataComplete = filteredRecords.length > 0;
              } else {
                // 🔧 95%阈值：1094条以上认为完整（1099/1152 = 95.4% ✅）
                isDataComplete = filteredRecords.length >= Math.floor(1152 * 0.95);
              }
            }
          } else if (source === 'sglotteries') {
            // SG Lotteries：所有彩种每天288期（每5分钟一期）
            expectedCount = 288;
            // 🔧 如果是今天，只要有数据就认为完整
            if (isToday) {
              isDataComplete = filteredRecords.length > 0;
            } else {
              // 🔧 95%阈值：273条以上认为完整
              isDataComplete = filteredRecords.length >= Math.floor(288 * 0.95);
            }
          } else if (source === 'auluckylotteries') {
            // AU Lucky Lotteries：所有彩种每天288期（每5分钟一期）
            expectedCount = 288;
            // 🔧 如果是今天，只要有数据就认为完整
            if (isToday) {
              isDataComplete = filteredRecords.length > 0;
            } else {
              // 🔧 95%阈值：273条以上认为完整
              isDataComplete = filteredRecords.length >= Math.floor(288 * 0.95);
            }
          } else if (source === 'luckylottoz') {
            // LuckyLottoz（幸运飞艇）：每天180期（每5分钟一期，销售日13:09~次日04:04）
            expectedCount = 180;
            // 🔧 如果是今天，只要有数据就认为完整
            if (isToday) {
              isDataComplete = filteredRecords.length > 0;
            } else {
              // 🔧 95%阈值：171条以上认为完整
              isDataComplete = filteredRecords.length >= Math.floor(180 * 0.95);
            }
          } else if (source === 'uklottos') {
            // UK Lottos：每天576期（每2.5分钟一期，24小时运营）
            expectedCount = 576;
            // 🔧 如果是今天，只要有数据就认为完整
            if (isToday) {
              isDataComplete = filteredRecords.length > 0;
            } else {
              // 🔧 95%阈值：547条以上认为完整
              isDataComplete = filteredRecords.length >= Math.floor(576 * 0.95);
            }
          } else {
            // 其他数据源：有数据就认为完整
            isDataComplete = filteredRecords.length > 0;
          }

          // 🎯 新逻辑：区分"可用完整"和"真正完整"
          // - 95-99%：立即返回（不显示警告）+ 后台补全到100%
          // - 100%以上：直接返回，不补全
          // - 95%以下：立即返回（显示警告）+ 后台补全

          const completenessPercent = (filteredRecords.length / expectedCount) * 100;
          const is95PercentComplete = isDataComplete; // 95%以上
          const is100PercentComplete = expectedCount === 0 || completenessPercent >= 99.5; // 99.5%以上算100%

          // 📊 情况1：100%完整 - 直接返回，不补全
          if (is100PercentComplete && filteredRecords.length > 0) {
            const statusMsg = isToday
              ? `数据库已有数据，直接返回 (${filteredRecords.length}条，今天还在进行中)`
              : `数据库100%完整，直接返回 (${filteredRecords.length}条)`;
            logger.info(`[Web] ✅ ${name} ${date} ${statusMsg}`);

            // 按开奖时间降序排序（从晚到早：120→001）
            const sortedRecords = filteredRecords.sort((a, b) => {
              const timeA = new Date(a.draw_time);
              const timeB = new Date(b.draw_time);
              return timeB - timeA; // 降序：最新的在前
            });

            // 手动分页
            const page = parseInt(pageNo) || 1;
            const size = parseInt(pageSize) || filteredRecords.length;  // 默认返回所有记录
            const start = (page - 1) * size;
            const end = start + size;
            const paginatedRecords = sortedRecords.slice(start, end);

            // 🎯 为每条记录添加source字段
            const recordsWithSource = paginatedRecords.map(record => ({
              ...record,
              source: source || 'database'
            }));

            return res.json({
              success: true,
              data: {
                lotCode,
                name,
                records: recordsWithSource,
                total: filteredRecords.length,
                pageNo: page,
                pageSize: size,
                totalPages: Math.ceil(filteredRecords.length / size)
              },
              message: '数据来自数据库'
            });
          }

          // 📊 情况2：95-99%完整 - 立即返回（不显示警告）+ 后台补全到100%
          if (is95PercentComplete && !is100PercentComplete && filteredRecords.length > 0) {
            logger.info(`[Web] ⚡ ${name} ${date} 数据${completenessPercent.toFixed(1)}%完整 (${filteredRecords.length}/${expectedCount})，立即返回 + 静默补全`);

            // 按开奖时间降序排序
            const sortedRecords = filteredRecords.sort((a, b) => {
              const timeA = new Date(a.draw_time);
              const timeB = new Date(b.draw_time);
              return timeB - timeA;
            });

            // 手动分页
            const page = parseInt(pageNo) || 1;
            const size = parseInt(pageSize) || filteredRecords.length;
            const start = (page - 1) * size;
            const end = start + size;
            const paginatedRecords = sortedRecords.slice(start, end);

            // 🎯 为每条记录添加source字段
            const recordsWithSource = paginatedRecords.map(record => ({
              ...record,
              source: source || 'database'
            }));

            // ⚡ 立即返回响应（标记incomplete，显示警告提示用户数据正在补全）
            res.json({
              success: true,
              data: {
                lotCode,
                name,
                records: recordsWithSource,
                total: filteredRecords.length,
                pageNo: page,
                pageSize: size,
                totalPages: Math.ceil(filteredRecords.length / size),
                incomplete: true,  // 🏷️ 标记为不完整，让前端显示警告
                expectedCount,
                actualCount: filteredRecords.length
              },
              message: `数据补全中 (${filteredRecords.length}/${expectedCount}条)`
            });

            // ⚡ 后台静默补全到100%（不阻塞响应）
            setImmediate(async () => {
              try {
                logger.info(`[Web] 🔄 后台静默补全任务启动: ${name} ${date} (${filteredRecords.length}→${expectedCount})`);
                let records = [];

                // 根据数据源调用不同的scraper
                if (source === 'speedylot88') {
                  const speedyLot88Scraper = (await import('../scrapers/SpeedyLot88Scraper.js')).default;
                  records = await speedyLot88Scraper.fetchHistoryData(scraperKey, date);
                } else if (source === 'sglotteries') {
                  const sgLotteriesScraper = (await import('../scrapers/SGLotteriesScraper.js')).default;
                  records = await sgLotteriesScraper.fetchHistoryData(scraperKey, date);
                } else if (source === 'auluckylotteries') {
                  const auLuckyLotteriesScraper = (await import('../scrapers/AULuckyLotteriesScraper.js')).default;
                  const apiEndpoint = lotteryConfig.apiEndpoint;
                  records = await auLuckyLotteriesScraper.fetchHistoryData(scraperKey, apiEndpoint, date);
                } else if (source === 'luckysscai') {
                  const luckySscaiScraper = (await import('../scrapers/LuckySscaiScraper.js')).default;
                  records = await luckySscaiScraper.fetchHistoryData(scraperKey, { date });
                } else if (source === 'luckylottoz') {
                  const luckyLottozScraper = (await import('../scrapers/LuckyLottozScraper.js')).default;
                  records = await luckyLottozScraper.fetchHistoryData(date);
                } else if (source === 'uklottos') {
                  const UKLottosScraper = (await import('../scrapers/UKLottosScraper.js')).default;
                  const ukLottosScraper = new UKLottosScraper();
                  records = await ukLottosScraper.fetchHistoryData(lotCode, { date });
                }

                if (records && records.length > 0) {
                  // 转换数据格式并保存
                  const dbRecords = records.map(record => {
                    let mysqlDrawTime = record.drawTime || record.draw_time;
                    if (mysqlDrawTime && mysqlDrawTime.includes(',')) {
                      try {
                        const cleanedTime = mysqlDrawTime.replace(/,/g, ' ').replace(/\\s+/g, ' ').trim();
                        const parsedDate = new Date(cleanedTime);
                        if (!isNaN(parsedDate.getTime())) {
                          const year = parsedDate.getFullYear();
                          const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
                          const day = String(parsedDate.getDate()).padStart(2, '0');
                          const hours = String(parsedDate.getHours()).padStart(2, '0');
                          const minutes = String(parsedDate.getMinutes()).padStart(2, '0');
                          const seconds = String(parsedDate.getSeconds()).padStart(2, '0');
                          mysqlDrawTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
                        }
                      } catch (e) {
                        logger.warn(`[Web] 静默补全-时间格式转换失败: ${mysqlDrawTime}`, e.message);
                      }
                    }

                    return {
                      issue: record.issue || record.period,
                      drawCode: record.drawCode || record.draw_code || record.opencode,
                      drawTime: mysqlDrawTime
                    };
                  });

                  // 保存到数据库（替换模式）
                  await database.saveHistoryData(lotCode, dbRecords, {
                    replaceExisting: true,
                    date: date
                  });
                  logger.info(`[Web] ✅ 静默补全完成: ${name} ${date} - ${filteredRecords.length}→${records.length}条`);
                } else {
                  logger.warn(`[Web] ⚠️ 静默补全失败: ${name} ${date} - 未获取到数据`);
                }
              } catch (error) {
                logger.error(`[Web] ❌ 静默补全失败: ${name} ${date} - ${error.message}`);
              }
            });

            return; // ⚡ 已返回响应，终止后续逻辑
          }

          // 📊 情况3：<95%不完整 - 立即返回（显示警告）+ 后台补全
          if (!is95PercentComplete && filteredRecords.length > 0) {
            // ⚡ 数据不完整，立即返回现有数据，后台异步补全
            logger.warn(`[Web] ⚡ ${name} ${date} 数据不完整 (${filteredRecords.length}/${expectedCount}条)，立即返回 + 后台补全`);

            // 按开奖时间降序排序
            const sortedRecords = filteredRecords.sort((a, b) => {
              const timeA = new Date(a.draw_time);
              const timeB = new Date(b.draw_time);
              return timeB - timeA;
            });

            // 手动分页
            const page = parseInt(pageNo) || 1;
            const size = parseInt(pageSize) || filteredRecords.length;
            const start = (page - 1) * size;
            const end = start + size;
            const paginatedRecords = sortedRecords.slice(start, end);

            // 🎯 为每条记录添加source字段
            const recordsWithSource = paginatedRecords.map(record => ({
              ...record,
              source: source || 'database'
            }));

            // ⚡ 先立即返回响应（秒返回！）
            res.json({
              success: true,
              data: {
                lotCode,
                name,
                records: recordsWithSource,
                total: filteredRecords.length,
                pageNo: page,
                pageSize: size,
                totalPages: Math.ceil(filteredRecords.length / size),
                incomplete: true,  // 🏷️ 标记数据不完整
                expectedCount,
                actualCount: filteredRecords.length
              },
              message: `数据补全中 (${filteredRecords.length}/${expectedCount}条)`
            });

            // ⚡ 后台异步补全数据（不阻塞响应）
            setImmediate(async () => {
              try {
                logger.info(`[Web] 🔄 后台补全任务启动: ${name} ${date}`);
                let records = [];

                // 根据数据源调用不同的scraper
                if (source === 'speedylot88') {
                  const speedyLot88Scraper = (await import('../scrapers/SpeedyLot88Scraper.js')).default;
                  records = await speedyLot88Scraper.fetchHistoryData(scraperKey, date);
                } else if (source === 'sglotteries') {
                  const sgLotteriesScraper = (await import('../scrapers/SGLotteriesScraper.js')).default;
                  records = await sgLotteriesScraper.fetchHistoryData(scraperKey, date);
                } else if (source === 'auluckylotteries') {
                  const auLuckyLotteriesScraper = (await import('../scrapers/AULuckyLotteriesScraper.js')).default;
                  const apiEndpoint = lotteryConfig.apiEndpoint;
                  records = await auLuckyLotteriesScraper.fetchHistoryData(scraperKey, apiEndpoint, date);
                } else if (source === 'luckysscai') {
                  const luckySscaiScraper = (await import('../scrapers/LuckySscaiScraper.js')).default;
                  records = await luckySscaiScraper.fetchHistoryData(scraperKey, { date });
                } else if (source === 'luckylottoz') {
                  const luckyLottozScraper = (await import('../scrapers/LuckyLottozScraper.js')).default;
                  records = await luckyLottozScraper.fetchHistoryData(date);
                } else if (source === 'uklottos') {
                  const UKLottosScraper = (await import('../scrapers/UKLottosScraper.js')).default;
                  const ukLottosScraper = new UKLottosScraper();
                  records = await ukLottosScraper.fetchHistoryData(lotCode, { date });
                }

                if (records && records.length > 0) {
                  // 转换数据格式并保存
                  const dbRecords = records.map(record => {
                    let mysqlDrawTime = record.drawTime || record.draw_time;
                    if (mysqlDrawTime && mysqlDrawTime.includes(',')) {
                      try {
                        const cleanedTime = mysqlDrawTime.replace(/,/g, ' ').replace(/\\s+/g, ' ').trim();
                        const date = new Date(cleanedTime);
                        if (!isNaN(date.getTime())) {
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          const hours = String(date.getHours()).padStart(2, '0');
                          const minutes = String(date.getMinutes()).padStart(2, '0');
                          const seconds = String(date.getSeconds()).padStart(2, '0');
                          mysqlDrawTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
                        }
                      } catch (e) {
                        logger.warn(`[Web] 后台补全-时间格式转换失败: ${mysqlDrawTime}`, e.message);
                      }
                    }

                    return {
                      issue: record.issue || record.period,
                      drawCode: record.drawCode || record.draw_code || record.opencode,
                      drawTime: mysqlDrawTime
                    };
                  });

                  // 保存到数据库（替换模式）
                  await database.saveHistoryData(lotCode, dbRecords, {
                    replaceExisting: true,
                    date: date
                  });
                  logger.info(`[Web] ✅ 后台补全完成: ${name} ${date} - ${records.length}条 (替换模式)`);
                } else {
                  logger.warn(`[Web] ⚠️ 后台补全失败: ${name} ${date} - 未获取到数据`);
                }
              } catch (error) {
                logger.error(`[Web] ❌ 后台补全失败: ${name} ${date} - ${error.message}`);
              }
            });

            return; // ⚡ 已返回响应，终止后续逻辑
          }
        }

        // ⚡ 数据库完全没有数据 - 立即返回loading状态 + 后台抓取
        logger.info(`[Web] ⚡ ${name} ${date} 数据库无数据，立即返回loading + 后台抓取`);

        // ⚡ 立即返回loading响应（秒返回！）
        res.json({
          success: true,
          data: {
            lotCode,
            name,
            records: [],
            total: 0,
            pageNo: 1,
            pageSize: parseInt(pageSize) || 50,
            totalPages: 0,
            loading: true  // 🏷️ 标记正在加载中
          },
          message: '数据加载中，请稍后刷新...'
        });

        // ⚡ 后台异步抓取数据（不阻塞响应）
        setImmediate(async () => {
          try {
            logger.info(`[Web] 🔄 后台抓取任务启动: ${name} ${date}`);
            let records = [];

            // 根据数据源调用不同的scraper
            if (source === 'speedylot88') {
              // SpeedyLot88官网数据源
              if (!scraperKey) {
                logger.error(`[Web] ❌ 后台抓取失败: 缺少scraperKey`);
                return;
              }
              const speedyLot88Scraper = (await import('../scrapers/SpeedyLot88Scraper.js')).default;
              records = await speedyLot88Scraper.fetchHistoryData(scraperKey, date);
            } else if (source === 'sglotteries') {
              if (!scraperKey) {
                logger.error(`[Web] ❌ 后台抓取失败: 缺少scraperKey`);
                return;
              }
              const sgLotteriesScraper = (await import('../scrapers/SGLotteriesScraper.js')).default;
              records = await sgLotteriesScraper.fetchHistoryData(scraperKey, date);
            } else if (source === 'auluckylotteries') {
              if (!scraperKey) {
                logger.error(`[Web] ❌ 后台抓取失败: 缺少scraperKey`);
                return;
              }
              const auLuckyLotteriesScraper = (await import('../scrapers/AULuckyLotteriesScraper.js')).default;
              const apiEndpoint = lotteryConfig.apiEndpoint;
              records = await auLuckyLotteriesScraper.fetchHistoryData(scraperKey, apiEndpoint, date);
            } else if (source === 'luckysscai') {
              if (!scraperKey) {
                logger.error(`[Web] ❌ 后台抓取失败: 缺少scraperKey`);
                return;
              }
              const luckySscaiScraper = (await import('../scrapers/LuckySscaiScraper.js')).default;
              records = await luckySscaiScraper.fetchHistoryData(scraperKey, { date });
            } else if (source === 'luckylottoz') {
              if (!scraperKey) {
                logger.error(`[Web] ❌ 后台抓取失败: 缺少scraperKey`);
                return;
              }
              const luckyLottozScraper = (await import('../scrapers/LuckyLottozScraper.js')).default;
              records = await luckyLottozScraper.fetchHistoryData(date);
            } else if (source === 'uklottos') {
              if (!scraperKey) {
                logger.error(`[Web] ❌ 后台抓取失败: 缺少scraperKey`);
                return;
              }
              const UKLottosScraper = (await import('../scrapers/UKLottosScraper.js')).default;
              const ukLottosScraper = new UKLottosScraper();
              records = await ukLottosScraper.fetchHistoryData(lotCode, { date });
            } else {
              logger.error(`[Web] ❌ 后台抓取失败: 不支持的数据源 ${source}`);
              return;
            }

            if (!records || records.length === 0) {
              logger.warn(`[Web] ⚠️ 后台抓取完成: ${name} ${date} - 暂无数据`);
              return;
            }

            // 转换数据格式并保存
            const dbRecords = records.map(record => {
              let mysqlDrawTime = record.drawTime || record.draw_time;
              if (mysqlDrawTime && mysqlDrawTime.includes(',')) {
                try {
                  const cleanedTime = mysqlDrawTime.replace(/,/g, ' ').replace(/\\s+/g, ' ').trim();
                  const parsedDate = new Date(cleanedTime);
                  if (!isNaN(parsedDate.getTime())) {
                    const year = parsedDate.getFullYear();
                    const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
                    const day = String(parsedDate.getDate()).padStart(2, '0');
                    const hours = String(parsedDate.getHours()).padStart(2, '0');
                    const minutes = String(parsedDate.getMinutes()).padStart(2, '0');
                    const seconds = String(parsedDate.getSeconds()).padStart(2, '0');
                    mysqlDrawTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
                  }
                } catch (e) {
                  logger.warn(`[Web] 后台抓取-时间格式转换失败: ${mysqlDrawTime}`, e.message);
                }
              }

              return {
                issue: record.issue || record.period,
                drawCode: record.drawCode || record.draw_code || record.opencode,
                drawTime: mysqlDrawTime
              };
            });

            // 保存到数据库
            await database.saveHistoryData(lotCode, dbRecords, {
              replaceExisting: false,
              date: date
            });
            logger.info(`[Web] ✅ 后台抓取完成: ${name} ${date} - ${records.length}条`);
          } catch (error) {
            logger.error(`[Web] ❌ 后台抓取失败: ${name} ${date} - ${error.message}`);
          }
        });
      } catch (error) {
        logger.error(`获取历史数据失败: ${lotCode} ${date}`, error.message);
        logger.error(`错误详情: ${error.stack}`);

        // ⚡ 新逻辑：已经在前面立即返回响应，不需要fallback逻辑
        // 如果代码执行到这里，说明是在初始化阶段发生的错误
        if (!res.headersSent) {
          return res.status(500).json({
            success: false,
            error: error.message
          });
        }
      }
    });

    // API: 手动触发爬取
    this.app.post('/api/crawl', async (req, res) => {
      try {
        const { lotCode } = req.body;

        if (!lotCode) {
          return res.status(400).json({
            success: false,
            error: '缺少 lotCode 参数'
          });
        }

        // 使用 LotteryConfigManager 查询配置
        const config = lotteryConfigManager.getLottery(lotCode);
        if (!config) {
          return res.status(404).json({
            success: false,
            error: '彩种不存在'
          });
        }

        // 获取当前活跃的调度器
        const schedulerMode = process.env.SCHEDULER_MODE || 'continuous';
        const activeScheduler =
          schedulerMode === 'fixed' ? fixedScheduler :
          schedulerMode === 'dynamic' ? dynamicScheduler :
          continuousScheduler;

        // 触发爬取（根据调度器类型调用不同的方法）
        logger.info(`[Web] 手动触发爬取: ${config.name} (${lotCode})`);

        if (schedulerMode === 'fixed') {
          await activeScheduler.crawlLottery(lotCode, config.name);
        } else if (schedulerMode === 'dynamic') {
          await activeScheduler.triggerManualCrawl(lotCode);
        } else {
          await activeScheduler.triggerPoll(lotCode);
        }

        res.json({
          success: true,
          message: `已触发爬取: ${config.name}`
        });
      } catch (error) {
        logger.error('手动爬取失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 手动触发历史数据爬取
    this.app.post('/api/crawl-history', async (req, res) => {
      try {
        const { lotCode, pageSize } = req.body;

        if (!lotCode) {
          return res.status(400).json({
            success: false,
            error: '缺少 lotCode 参数'
          });
        }

        const config = lotteryConfigManager.getLottery(lotCode);
        if (!config) {
          return res.status(404).json({
            success: false,
            error: '彩种不存在'
          });
        }

        const size = parseInt(pageSize) || 100;
        logger.info(`[Web] 手动触发历史数据爬取: ${config.name} (${lotCode}) - ${size}条`);

        // 异步执行历史数据爬取，不阻塞响应
        setImmediate(async () => {
          try {
            await scheduler.crawlHistory(lotCode, config.name);
          } catch (error) {
            logger.error(`历史数据爬取失败: ${config.name}`, error);
          }
        });

        res.json({
          success: true,
          message: `已触发历史数据爬取: ${config.name}`
        });
      } catch (error) {
        logger.error('手动历史数据爬取触发失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 获取日志（增强版：支持解析、过滤、分页）
    this.app.get('/api/logs', (req, res) => {
      try {
        const {
          lines = 500,
          level = '',
          source = '',
          keyword = '',
          startTime = '',
          endTime = ''
        } = req.query;

        const logsDir = path.join(__dirname, '../../logs');

        // 🔍 查找所有日志文件（支持日志轮转）
        const allLogFiles = fs.readdirSync(logsDir)
          .filter(f => f.startsWith('crawler') && f.endsWith('.log'))
          .map(f => {
            const filepath = path.join(logsDir, f);
            const stats = fs.statSync(filepath);
            return { filepath, mtime: stats.mtimeMs, filename: f };
          })
          .sort((a, b) => b.mtime - a.mtime); // 按时间倒序

        if (allLogFiles.length === 0) {
          return res.json({
            success: true,
            data: [],
            total: 0,
            metadata: {
              totalFiles: 0,
              latestFile: null
            }
          });
        }

        // 📖 读取最新的3个日志文件（确保获取足够的日志）
        const filesToRead = allLogFiles.slice(0, 3);
        let allLines = [];

        for (const { filepath } of filesToRead) {
          const content = fs.readFileSync(filepath, 'utf-8');
          const fileLines = content.split('\n').filter(line => line.trim());
          allLines = allLines.concat(fileLines);
        }

        // 🔧 解析日志结构
        const logPattern = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] (\w+): (.+)$/;
        const parsedLogs = allLines.map((line, index) => {
          const match = line.match(logPattern);

          if (match) {
            const [, timestamp, logLevel, message] = match;

            // 提取日志来源（从消息中提取 [Source] 标记）
            const sourceMatch = message.match(/^\[([^\]]+)\]/);
            const logSource = sourceMatch ? sourceMatch[1] : 'system';

            return {
              id: index,
              timestamp: new Date(timestamp).toISOString(),
              level: logLevel.toLowerCase(),
              source: logSource,
              message: message,
              raw: line
            };
          } else {
            // 未匹配的行（可能是多行日志的后续行）
            return {
              id: index,
              timestamp: new Date().toISOString(),
              level: 'info',
              source: 'system',
              message: line,
              raw: line
            };
          }
        });

        // 🎯 应用过滤条件
        let filteredLogs = parsedLogs;

        // 按级别过滤
        if (level) {
          filteredLogs = filteredLogs.filter(log => log.level === level.toLowerCase());
        }

        // 按来源过滤
        if (source) {
          filteredLogs = filteredLogs.filter(log =>
            log.source.toLowerCase().includes(source.toLowerCase())
          );
        }

        // 按关键词过滤
        if (keyword) {
          filteredLogs = filteredLogs.filter(log =>
            log.message.toLowerCase().includes(keyword.toLowerCase())
          );
        }

        // 按时间范围过滤
        if (startTime) {
          const start = new Date(startTime);
          filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= start);
        }
        if (endTime) {
          const end = new Date(endTime);
          filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= end);
        }

        // 📊 获取最近N行
        const recentLogs = filteredLogs.slice(-parseInt(lines));

        // 📈 统计信息
        const stats = {
          info: filteredLogs.filter(l => l.level === 'info').length,
          warn: filteredLogs.filter(l => l.level === 'warn').length,
          error: filteredLogs.filter(l => l.level === 'error').length,
          debug: filteredLogs.filter(l => l.level === 'debug').length
        };

        res.json({
          success: true,
          data: recentLogs,
          total: filteredLogs.length,
          stats,
          metadata: {
            totalFiles: allLogFiles.length,
            latestFile: allLogFiles[0].filename,
            filesRead: filesToRead.map(f => f.filename)
          }
        });
      } catch (error) {
        logger.error('❌ 读取日志失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 健康检查
    this.app.get('/api/health', (req, res) => {
      res.json({
        success: true,
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    });

    // API: CountdownManager统计信息
    this.app.get('/api/countdown/stats', (req, res) => {
      try {
        if (!this.countdownManager) {
          return res.json({
            success: false,
            error: 'CountdownManager未初始化'
          });
        }

        const states = this.countdownManager.getAllStates();
        const lotCodes = Object.keys(states);

        // 计算内存使用估算（每个状态约100字节）
        const estimatedMemoryKB = (lotCodes.length * 100 / 1024).toFixed(2);

        // 统计不同倒计时范围的彩种数量
        const countdownRanges = {
          zero: 0,        // 0秒
          under10: 0,     // 1-9秒
          under30: 0,     // 10-29秒
          under60: 0,     // 30-59秒
          over60: 0       // 60秒以上
        };

        lotCodes.forEach(lotCode => {
          const countdown = states[lotCode].countdown;
          if (countdown === 0) countdownRanges.zero++;
          else if (countdown < 10) countdownRanges.under10++;
          else if (countdown < 30) countdownRanges.under30++;
          else if (countdown < 60) countdownRanges.under60++;
          else countdownRanges.over60++;
        });

        res.json({
          success: true,
          data: {
            isRunning: this.countdownManager.isRunning,
            totalLotteries: lotCodes.length,
            estimatedMemoryKB: parseFloat(estimatedMemoryKB),
            countdownRanges,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        logger.error('获取CountdownManager统计失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 获取调度器统计信息
    this.app.get('/api/scheduler/stats', (req, res) => {
      try {
        const schedulerMode = process.env.SCHEDULER_MODE || 'continuous';
        const scheduler = schedulerMode === 'fixed' ? fixedScheduler :
                          schedulerMode === 'dynamic' ? dynamicScheduler :
                          continuousScheduler;
        const stats = scheduler.getStats();

        res.json({
          success: true,
          data: stats
        });
      } catch (error) {
        logger.error('获取调度器统计失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 获取系统总览
    this.app.get('/api/system/overview', async (req, res) => {
      try {
        // 获取调度器统计
        const schedulerMode = process.env.SCHEDULER_MODE || 'continuous';
        const scheduler = schedulerMode === 'fixed' ? fixedScheduler :
                          schedulerMode === 'dynamic' ? dynamicScheduler :
                          continuousScheduler;
        const schedulerStats = scheduler.getStats();

        // 获取CountdownManager统计
        let countdownStats = null;
        if (this.countdownManager) {
          const states = this.countdownManager.getAllStates();
          const lotCodes = Object.keys(states);
          countdownStats = {
            isRunning: this.countdownManager.isRunning,
            totalLotteries: lotCodes.length,
            estimatedMemoryKB: parseFloat((lotCodes.length * 100 / 1024).toFixed(2))
          };
        }

        // 获取WebSocket统计
        let websocketStats = null;
        if (this.wsManager) {
          websocketStats = {
            totalConnections: this.wsManager.clients.size,
            totalSubscriptions: this.wsManager.subscriptions.size
          };
        }

        // 获取数据库连接状态
        const dbConnected = await database.testConnection();

        res.json({
          success: true,
          data: {
            scheduler: schedulerStats,
            countdown: countdownStats,
            websocket: websocketStats,
            database: {
              connected: dbConnected,
              status: dbConnected ? 'online' : 'offline'
            },
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        logger.error('获取系统总览失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 重启服务
    this.app.post('/api/system/restart', (req, res) => {
      try {
        logger.warn('⚠️ 收到服务重启请求');

        res.json({
          success: true,
          message: '服务将在2秒后重启'
        });

        // 延迟2秒后退出进程，让响应有时间发送
        setTimeout(() => {
          logger.warn('🔄 正在重启服务...');
          process.exit(0); // PM2或其他进程管理器会自动重启
        }, 2000);
      } catch (error) {
        logger.error('重启服务失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // ==================== 数据库统计与维护 API ====================

    // API: 获取数据库统计信息
    this.app.get('/api/database/statistics', async (req, res) => {
      try {
        const stats = await databaseMonitor.getStatistics();
        res.json({
          success: true,
          data: stats
        });
      } catch (error) {
        logger.error('获取数据库统计失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 获取数据库健康状态
    this.app.get('/api/database/health', async (req, res) => {
      try {
        const health = await databaseMonitor.checkHealth();
        res.json({
          success: true,
          data: health
        });
      } catch (error) {
        logger.error('获取数据库健康状态失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 获取优化建议
    this.app.get('/api/database/suggestions', async (req, res) => {
      try {
        const suggestions = await databaseMonitor.generateOptimizationSuggestions();
        res.json({
          success: true,
          data: suggestions
        });
      } catch (error) {
        logger.error('获取优化建议失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 清理重复数据
    this.app.post('/api/database/clean-duplicates', async (req, res) => {
      try {
        const { dryRun = true } = req.body;
        const result = await databaseMaintenance.cleanDuplicates({ dryRun });
        res.json({
          success: true,
          data: result,
          message: dryRun ? '模拟运行完成' : '清理完成'
        });
      } catch (error) {
        logger.error('清理重复数据失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 清理老数据
    this.app.post('/api/database/clean-old-data', async (req, res) => {
      try {
        const { dryRun = true, daysToKeep = 365 } = req.body;
        const result = await databaseMaintenance.cleanOldData({ dryRun, daysToKeep });
        res.json({
          success: true,
          data: result,
          message: dryRun ? '模拟运行完成' : '清理完成'
        });
      } catch (error) {
        logger.error('清理老数据失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 优化表
    this.app.post('/api/database/optimize', async (req, res) => {
      try {
        const result = await databaseMaintenance.optimizeTable();
        res.json({
          success: true,
          data: result,
          message: '表优化完成'
        });
      } catch (error) {
        logger.error('表优化失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 执行完整维护
    this.app.post('/api/database/full-maintenance', async (req, res) => {
      try {
        const { dryRun = true } = req.body;
        const result = await databaseMaintenance.performFullMaintenance({ dryRun });
        res.json({
          success: true,
          data: result,
          message: dryRun ? '模拟运行完成' : '维护完成'
        });
      } catch (error) {
        logger.error('数据库维护失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // ==================== 历史数据回填 API ====================

    // API: 清理SG彩种旧数据
    this.app.post('/api/cleanup-sg-data', async (req, res) => {
      try {
        const sgLotCodes = ['20001', '20002', '20003', '20004', '20005', '20006'];
        const results = [];

        for (const lotCode of sgLotCodes) {
          // 查询数据量
          const countQuery = `SELECT COUNT(*) as total FROM lottery_results WHERE lot_code = ?`;
          const pool = database._initPool();
          const [countResult] = await pool.query(countQuery, [lotCode]);
          const total = countResult[0].total;

          // 删除数据
          if (total > 0) {
            const deleteQuery = `DELETE FROM lottery_results WHERE lot_code = ?`;
            await pool.query(deleteQuery, [lotCode]);
            results.push({ lotCode, deleted: total });
            logger.info(`[Cleanup] SG彩种 ${lotCode}: 删除 ${total} 条旧数据`);
          } else {
            results.push({ lotCode, deleted: 0 });
          }
        }

        res.json({
          success: true,
          message: 'SG彩种旧数据清理完成',
          results
        });
      } catch (error) {
        logger.error('清理SG数据失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 按日期回填历史数据
    this.app.post('/api/history/backfill-date', async (req, res) => {
      try {
        const { lotCode, date, force = false } = req.body;

        if (!lotCode || !date) {
          return res.status(400).json({
            success: false,
            error: '缺少 lotCode 或 date 参数'
          });
        }

        const lotteryConfig = lotteryConfigManager.getLottery(lotCode);
        const name = lotteryConfig ? lotteryConfig.name : lotCode;

        logger.info(`[Web] 手动触发日期回填: ${name} (${lotCode}) - ${date}`);

        // 异步执行回填
        setImmediate(async () => {
          try {
            await historyBackfill.backfillByDate(lotCode, date, { name, force });
          } catch (error) {
            logger.error(`日期回填失败: ${name} (${lotCode}) - ${date}`, error);
          }
        });

        res.json({
          success: true,
          message: `已触发 ${name} 在 ${date} 的历史数据回填，请稍后查看`
        });
      } catch (error) {
        logger.error('触发日期回填失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 回填最近N天的历史数据
    this.app.post('/api/history/backfill-recent', async (req, res) => {
      try {
        const { lotCode, days = 30 } = req.body;

        if (!lotCode) {
          return res.status(400).json({
            success: false,
            error: '缺少 lotCode 参数'
          });
        }

        const lotteryConfig = lotteryConfigManager.getLottery(lotCode);
        const name = lotteryConfig ? lotteryConfig.name : lotCode;

        logger.info(`[Web] 手动触发批量回填: ${name} (${lotCode}) - 最近${days}天`);

        // 异步执行回填
        setImmediate(async () => {
          try {
            await historyBackfill.backfillRecentDays(lotCode, days, { name });
          } catch (error) {
            logger.error(`批量回填失败: ${name} (${lotCode})`, error);
          }
        });

        res.json({
          success: true,
          message: `已触发 ${name} 最近${days}天的历史数据回填，请稍后查看`
        });
      } catch (error) {
        logger.error('触发批量回填失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 获取数据范围
    this.app.get('/api/history/data-range', async (req, res) => {
      try {
        const { lotCode } = req.query;

        if (!lotCode) {
          return res.status(400).json({
            success: false,
            error: '缺少 lotCode 参数'
          });
        }

        const range = await historyBackfill.getDataRange(lotCode);

        res.json({
          success: true,
          data: range
        });
      } catch (error) {
        logger.error('获取数据范围失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 获取正在进行的回填任务
    this.app.get('/api/history/active-tasks', (req, res) => {
      try {
        const tasks = historyBackfill.getActiveTasks();
        res.json({
          success: true,
          data: tasks
        });
      } catch (error) {
        logger.error('获取回填任务失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 检测缺失的日期
    this.app.get('/api/history/detect-missing', async (req, res) => {
      try {
        const { lotCode, days = 7 } = req.query;

        if (!lotCode) {
          return res.status(400).json({
            success: false,
            error: '缺少 lotCode 参数'
          });
        }

        const missingDates = await historyBackfill.detectMissingDates(lotCode, parseInt(days));

        res.json({
          success: true,
          data: {
            lotCode,
            days: parseInt(days),
            missingDates,
            count: missingDates.length
          }
        });
      } catch (error) {
        logger.error('检测缺失日期失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 自动回填单个彩种的缺失数据
    this.app.post('/api/history/auto-backfill', async (req, res) => {
      try {
        const { lotCode, days = 7 } = req.body;

        if (!lotCode) {
          return res.status(400).json({
            success: false,
            error: '缺少 lotCode 参数'
          });
        }

        const result = await historyBackfill.autoBackfillMissingDates(lotCode, parseInt(days));

        res.json({
          success: true,
          data: result
        });
      } catch (error) {
        logger.error('自动回填失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 自动回填所有彩种的缺失数据
    this.app.post('/api/history/auto-backfill-all', async (req, res) => {
      try {
        const { days = 7 } = req.body;

        logger.info(`开始批量自动回填，检查最近${days}天`);

        const result = await historyBackfill.autoBackfillAllLotteries(parseInt(days));

        res.json({
          success: true,
          data: result
        });
      } catch (error) {
        logger.error('批量自动回填失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 导出数据为CSV格式
    this.app.get('/api/export/csv', async (req, res) => {
      try {
        const { lotCode, date, startDate, endDate, limit = 10000 } = req.query;

        if (!lotCode) {
          return res.status(400).json({
            success: false,
            error: '缺少 lotCode 参数'
          });
        }

        const lotteryConfig = lotteryConfigManager.getLottery(lotCode);
        if (!lotteryConfig) {
          return res.status(404).json({
            success: false,
            error: '彩种不存在'
          });
        }

        let records = [];

        if (date) {
          // 按单日导出
          const result = await database.getHistoryData(lotCode, {
            pageNo: 1,
            pageSize: parseInt(limit),
            date
          });
          records = result.records;
        } else if (startDate && endDate) {
          // 按日期范围导出（简化实现，逐日查询）
          const start = new Date(startDate);
          const end = new Date(endDate);
          const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

          for (let i = 0; i < days && records.length < limit; i++) {
            const checkDate = new Date(start);
            checkDate.setDate(start.getDate() + i);
            const dateStr = checkDate.toISOString().split('T')[0];

            const result = await database.getHistoryData(lotCode, {
              pageNo: 1,
              pageSize: parseInt(limit) - records.length,
              date: dateStr
            });

            records = records.concat(result.records);
          }
        } else {
          // 导出最新的N条记录
          const result = await database.getHistoryData(lotCode, {
            pageNo: 1,
            pageSize: parseInt(limit)
          });
          records = result.records;
        }

        // 生成CSV内容
        const csvHeader = '序号,彩种,期号,开奖号码,开奖时间\n';
        const csvRows = records.map((record, index) => {
          const drawTime = new Date(record.draw_time).toLocaleString('zh-CN', {
            timeZone: 'Asia/Shanghai',
            hour12: false
          });
          return `${index + 1},"${lotteryConfig.name}","${record.issue}","${record.draw_code}","${drawTime}"`;
        }).join('\n');

        const csv = '\uFEFF' + csvHeader + csvRows; // 添加BOM以支持Excel打开中文

        // 设置响应头
        const filename = `${lotteryConfig.name}_${date || startDate || 'latest'}_${Date.now()}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
        res.send(csv);

      } catch (error) {
        logger.error('导出CSV失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // ==================== 官方数据源管理 API ====================

    // 获取所有官方数据源
    this.app.get('/api/sources', (req, res) => {
      try {
        const sources = officialSourceManager.getSources();

        // 🎯 获取所有彩种配置用于关联
        const allLotteries = lotteryConfigManager.getAllLotteries();

        // 转换为前端期望的格式（扁平化stats字段）
        const formattedSources = sources.map(source => {
          // 🎯 查找属于该数据源的所有彩种
          const sourceLotteries = allLotteries.filter(lot => lot.source === source.id);

          return {
            id: source.id,
            name: source.name,
            baseUrl: source.url,
            type: source.type,
            priority: source.priority || 99,
            enabled: source.enabled,
            needsProxy: false,
            status: source.status,
            responseTime: source.stats.avgResponseTime || 0,
            successRate: source.stats.totalRequests > 0
              ? ((source.stats.successRequests / source.stats.totalRequests) * 100).toFixed(2)
              : '0.00',
            lastCheck: source.stats.lastCheck,
            errors: source.stats.failedRequests || 0,
            totalRequests: source.stats.totalRequests || 0,
            successRequests: source.stats.successRequests || 0,
            endpointHealth: {},
            // 🎯 动态添加彩种列表（从 LotteryConfigManager 获取）
            lotteries: sourceLotteries.map(lot => ({
              lotCode: lot.lotCode,
              name: lot.name,
              enabled: lot.enabled
            })),
            description: source.description,
            updateInterval: source.updateInterval
          };
        });

        res.json({
          success: true,
          data: formattedSources,
          type: 'official'  // 标记为官方数据源
        });
      } catch (error) {
        logger.error('获取官方数据源失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 获取官方数据源统计
    this.app.get('/api/sources/stats', (req, res) => {
      try {
        const stats = officialSourceManager.getStats();
        res.json({
          success: true,
          data: stats,
          type: 'official'
        });
      } catch (error) {
        logger.error('获取官方数据源统计失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 获取官方数据源彩种列表（按数据源分组）
    this.app.get('/api/sources/lotteries', (req, res) => {
      try {
        const lotteries = officialSourceManager.getLotteriesBySource();
        res.json({
          success: true,
          data: lotteries
        });
      } catch (error) {
        logger.error('获取彩种列表失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 启用/禁用官方数据源
    this.app.post('/api/sources/:id/toggle', (req, res) => {
      try {
        const { id } = req.params;
        const { enabled } = req.body;

        const updated = officialSourceManager.toggleSource(id, enabled);

        if (updated) {
          res.json({
            success: true,
            data: updated,
            message: enabled ? '数据源已启用' : '数据源已禁用'
          });
        } else {
          res.status(404).json({
            success: false,
            error: '数据源不存在'
          });
        }
      } catch (error) {
        logger.error('切换数据源状态失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 手动健康检查（单个官方数据源）
    this.app.post('/api/sources/:id/check', async (req, res) => {
      try {
        const { id } = req.params;

        const result = await officialSourceManager.checkSourceHealth(id);

        res.json({
          success: result.success,
          data: result,
          message: result.success ? '健康检查通过' : '健康检查失败'
        });
      } catch (error) {
        logger.error('健康检查失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 手动健康检查（所有官方数据源）
    this.app.post('/api/sources/check-all', async (req, res) => {
      try {
        const results = await officialSourceManager.checkAllSourcesHealth();

        res.json({
          success: true,
          data: results,
          message: '健康检查完成'
        });
      } catch (error) {
        logger.error('健康检查失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 添加新数据源（只读提示）
    this.app.post('/api/sources', (req, res) => {
      try {
        const { name, baseUrl, type, priority, needsProxy } = req.body;

        // 官方数据源是预定义的，不支持动态添加
        // 提示用户使用彩种配置管理来添加新的数据源端点
        res.status(400).json({
          success: false,
          error: '官方数据源是预定义的系统级配置',
          message: '如需添加新数据源，请使用"彩种配置管理"页面添加新的数据源端点（Endpoint）',
          hint: '预定义的官方数据源包括：SpeedyLot88、中国福彩、中国体彩等'
        });
      } catch (error) {
        logger.error('添加数据源请求失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 更新官方数据源配置（允许修改URL、名称、描述等）
    this.app.put('/api/sources/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const { name, baseUrl, description, priority, updateInterval } = req.body;

        // 构建更新对象
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (baseUrl !== undefined) updates.url = baseUrl;
        if (description !== undefined) updates.description = description;
        if (priority !== undefined) updates.priority = parseInt(priority);
        if (updateInterval !== undefined) updates.updateInterval = parseInt(updateInterval);

        // 调用OfficialSourceManager更新配置（现在是async）
        const result = await officialSourceManager.updateSourceConfig(id, updates);

        if (result.success) {
          logger.info(`✅ 数据源配置已更新: ${id}`);

          // 🔧 过滤掉循环引用字段（scraperInstance等）
          const {scraperInstance, ...safeSource} = result.source;

          res.json({
            success: true,
            message: result.message,
            data: safeSource,
            updatedFields: result.updatedFields
          });
        } else {
          res.status(400).json({
            success: false,
            error: result.error
          });
        }
      } catch (error) {
        logger.error('更新数据源配置失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 重新加载数据源配置（热重载，无需重启服务）
    this.app.post('/api/sources/reload', (req, res) => {
      try {
        officialSourceManager.loadConfig();
        logger.info('✅ 已重新加载数据源配置');
        res.json({
          success: true,
          message: '数据源配置已重新加载',
          sources: officialSourceManager.getSources().map(s => ({
            id: s.id,
            name: s.name,
            url: s.url,
            enabled: s.enabled,
            status: s.status
          }))
        });
      } catch (error) {
        logger.error('重新加载数据源配置失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // ==================== 配置管理 API ====================

    // 获取系统配置
    this.app.get('/api/config', (req, res) => {
      try {
        const config = configManager.getAllConfig();
        res.json({
          success: true,
          data: config
        });
      } catch (error) {
        logger.error('获取配置失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 更新自动爬取开关
    this.app.post('/api/config/auto-crawl', async (req, res) => {
      try {
        const { enabled } = req.body;

        if (typeof enabled !== 'boolean') {
          return res.status(400).json({
            success: false,
            error: '参数 enabled 必须是布尔值'
          });
        }

        // 更新配置
        configManager.setAutoCrawlEnabled(enabled);

        // 重启调度器以应用新配置
        await scheduler.restart();

        res.json({
          success: true,
          data: {
            enableAutoCrawl: enabled
          },
          message: enabled ? '自动爬取已启用，调度器已重启' : '自动爬取已禁用，调度器已重启'
        });
      } catch (error) {
        logger.error('切换自动爬取失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // ==================== 彩种管理 API ====================

    // 获取所有彩种配置
    this.app.get('/api/lotteries/configs', async (req, res) => {
      try {
        const lotteries = lotteryConfigManager.getAllLotteries();
        const stats = lotteryConfigManager.getStats();
        const endpointMap = lotteryConfigManager.getAllEndpointConfigs();

        // 获取 lotCodeToScraperKey 映射
        const lotCodeToScraperKey = {};
        lotteries.forEach(lottery => {
          const scraperKey = lotteryConfigManager.getScraperKey(lottery.lotCode);
          if (scraperKey) {
            lotCodeToScraperKey[lottery.lotCode] = scraperKey;
          }
        });

        // 🔥 为每个彩种补充最新开奖数据和记录数
        const enrichedLotteries = await Promise.all(lotteries.map(async (lottery) => {
          try {
            // 查询记录总数
            const [[countResult]] = await database._initPool().query(
              'SELECT COUNT(*) as total FROM lottery_results WHERE lot_code = ?',
              [lottery.lotCode]
            );
            const recordCount = countResult?.total || 0;

            // 查询最新一期数据
            const [[latest]] = await database._initPool().query(
              'SELECT issue, draw_code, draw_time, special_numbers FROM lottery_results WHERE lot_code = ? ORDER BY id DESC LIMIT 1',
              [lottery.lotCode]
            );

            // 补充字段
            return {
              ...lottery,
              recordCount,
              issue: latest?.issue || null,
              numbers: latest?.draw_code ? latest.draw_code.split(',').map(n => parseInt(n.trim(), 10)) : [],
              drawTime: latest?.draw_time || null,
              specialNumbers: latest?.special_numbers ? latest.special_numbers.split(',').map(n => parseInt(n.trim(), 10)) : []
            };
          } catch (error) {
            logger.warn(`获取彩种 ${lottery.lotCode} 最新数据失败:`, error.message);
            return {
              ...lottery,
              recordCount: 0,
              issue: null,
              numbers: [],
              drawTime: null,
              specialNumbers: []
            };
          }
        }));

        res.json({
          success: true,
          data: {
            lotteries: enrichedLotteries,
            stats,
            endpointMap,
            lotCodeToScraperKey
          }
        });
      } catch (error) {
        logger.error('获取彩种配置失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 获取单个彩种配置
    this.app.get('/api/lotteries/configs/:lotCode', (req, res) => {
      try {
        const { lotCode } = req.params;
        const lottery = lotteryConfigManager.getLottery(lotCode);

        if (lottery) {
          res.json({
            success: true,
            data: lottery
          });
        } else {
          res.status(404).json({
            success: false,
            error: '彩种不存在'
          });
        }
      } catch (error) {
        logger.error('获取彩种配置失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 添加彩种
    this.app.post('/api/lotteries/configs', async (req, res) => {
      try {
        const lottery = lotteryConfigManager.addLottery(req.body);

        if (lottery) {
          // 触发调度器热重载
          const schedulerMode = process.env.SCHEDULER_MODE || 'continuous';
          const activeScheduler =
            schedulerMode === 'fixed' ? fixedScheduler :
            schedulerMode === 'dynamic' ? dynamicScheduler :
            continuousScheduler;

          if (activeScheduler.reloadLotteries) {
            await activeScheduler.reloadLotteries();
          }

          res.json({
            success: true,
            data: lottery,
            message: '彩种添加成功'
          });
        } else {
          res.status(400).json({
            success: false,
            error: '彩种已存在'
          });
        }
      } catch (error) {
        logger.error('添加彩种失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 更新彩种
    this.app.put('/api/lotteries/configs/:lotCode', async (req, res) => {
      try {
        const { lotCode } = req.params;
        const lottery = lotteryConfigManager.updateLottery(lotCode, req.body);

        if (lottery) {
          // 触发调度器热重载
          const schedulerMode = process.env.SCHEDULER_MODE || 'continuous';
          const activeScheduler =
            schedulerMode === 'fixed' ? fixedScheduler :
            schedulerMode === 'dynamic' ? dynamicScheduler :
            continuousScheduler;

          if (activeScheduler.reloadLotteries) {
            await activeScheduler.reloadLotteries();
          }

          res.json({
            success: true,
            data: lottery,
            message: '彩种更新成功'
          });
        } else {
          res.status(404).json({
            success: false,
            error: '彩种不存在'
          });
        }
      } catch (error) {
        logger.error('更新彩种失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 删除彩种
    this.app.delete('/api/lotteries/configs/:lotCode', async (req, res) => {
      try {
        const { lotCode } = req.params;
        const deleted = lotteryConfigManager.deleteLottery(lotCode);

        if (deleted) {
          // 触发调度器热重载
          const schedulerMode = process.env.SCHEDULER_MODE || 'continuous';
          const activeScheduler =
            schedulerMode === 'fixed' ? fixedScheduler :
            schedulerMode === 'dynamic' ? dynamicScheduler :
            continuousScheduler;

          if (activeScheduler.reloadLotteries) {
            await activeScheduler.reloadLotteries();
          }

          res.json({
            success: true,
            message: '彩种删除成功'
          });
        } else {
          res.status(404).json({
            success: false,
            error: '彩种不存在'
          });
        }
      } catch (error) {
        logger.error('删除彩种失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 切换彩种启用状态
    this.app.post('/api/lotteries/configs/:lotCode/toggle', async (req, res) => {
      try {
        const { lotCode } = req.params;
        const { enabled } = req.body;

        const lottery = lotteryConfigManager.toggleLottery(lotCode, enabled);

        if (lottery) {
          // 触发调度器热重载
          const schedulerMode = process.env.SCHEDULER_MODE || 'continuous';
          const activeScheduler =
            schedulerMode === 'fixed' ? fixedScheduler :
            schedulerMode === 'dynamic' ? dynamicScheduler :
            continuousScheduler;

          if (activeScheduler.reloadLotteries) {
            await activeScheduler.reloadLotteries();
          }

          res.json({
            success: true,
            data: lottery,
            message: enabled ? '彩种已启用' : '彩种已禁用'
          });
        } else {
          res.status(404).json({
            success: false,
            error: '彩种不存在'
          });
        }
      } catch (error) {
        logger.error('切换彩种状态失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 获取所有端点配置
    this.app.get('/api/lotteries/endpoints', (req, res) => {
      try {
        const endpoints = lotteryConfigManager.getAllEndpointConfigs();
        res.json({
          success: true,
          data: endpoints
        });
      } catch (error) {
        logger.error('获取端点配置失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 更新端点配置
    this.app.put('/api/lotteries/endpoints/:endpointType', (req, res) => {
      try {
        const { endpointType } = req.params;
        lotteryConfigManager.updateEndpointConfig(endpointType, req.body);

        res.json({
          success: true,
          message: '端点配置更新成功'
        });
      } catch (error) {
        logger.error('更新端点配置失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 🎯 API: 获取WebSocket连接统计
    this.app.get('/api/websocket/stats', (req, res) => {
      try {
        if (!this.wsManager) {
          return res.json({
            success: false,
            message: 'WebSocket服务未启动'
          });
        }

        const stats = this.wsManager.getStats();
        res.json({
          success: true,
          data: stats
        });
      } catch (error) {
        logger.error('获取WebSocket统计失败:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 📊 API: 获取WebSocket详细监控报告
    this.app.get('/api/websocket/monitor', (req, res) => {
      try {
        if (!this.wsManager) {
          return res.json({
            success: false,
            message: 'WebSocket服务未启动'
          });
        }

        const report = this.wsManager.getMonitorReport();
        res.json({
          success: true,
          data: report
        });
      } catch (error) {
        logger.error('获取WebSocket监控报告失败:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 注册告警API
    this.setupAlertAPIs();

    // Vue 3界面（支持客户端路由）- 必须放在最后，作为fallback路由
    this.app.get('*', (req, res) => {
      // 禁用缓存，确保始终获取最新版本
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  /**
   * 启动服务器
   */
  /**
   * 设置数据补全进度广播
   */
  async setupCompletionProgressBroadcast() {
    try {
      const dataCompletionService = (await import('../services/DataCompletionService.js')).default;
      const service = dataCompletionService.getInstance();

      // 监听补全进度事件
      service.on('progress', (progressData) => {
        if (this.wsManager) {
          this.wsManager.broadcastCompletionProgress(progressData);
        }
      });

      logger.info('[WebSocket] 数据补全进度广播已设置');
    } catch (error) {
      logger.error('[WebSocket] 设置补全进度广播失败:', error.message);
    }
  }

  start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          logger.success(`🌐 Web管理界面已启动: http://localhost:${this.port}`);

          // 🎯 启动 WebSocket 服务器
          try {
            this.wsManager = new WebSocketManager(this.server);
            logger.success(`📡 WebSocket服务器已启动: ws://localhost:${this.port}`);

            // 🕐 启动倒计时管理器（基于WebSocket推送）
            this.countdownManager = new CountdownManager(this.wsManager);

            // 🔗 将countdownManager引用赋给wsManager（用于SG彩种倒计时同步）
            this.wsManager.countdownManager = this.countdownManager;

            this.countdownManager.start();
            logger.success(`🕐 倒计时管理器已启动（每秒推送一次）`);

            // 🎯 连接数据补全服务的进度事件到WebSocket
            this.setupCompletionProgressBroadcast();
          } catch (wsError) {
            logger.error('WebSocket服务器启动失败:', wsError.message);
            // WebSocket失败不影响主服务
          }

          // 🎯 初始化系统设置服务和数据库驱动的告警服务
          try {
            const dbPool = database._initPool();

            // 初始化设置服务
            this.settingsService = new SettingsService(dbPool);
            logger.success(`⚙️ 系统设置服务已启动`);

            // 初始化告警服务（传入设置服务）
            this.alertServiceDB = new AlertServiceDB(dbPool, this.settingsService);
            this.alertServiceDB.initialize().then(() => {
              logger.success(`🚨 告警服务已启动`);
              // 🎯 注册到全局管理器，供调度器等模块使用
              alertServiceManager.initialize(this.alertServiceDB);
            }).catch(err => {
              logger.error('告警服务初始化失败:', err.message);
            });
          } catch (alertError) {
            logger.error('告警服务启动失败:', alertError.message);
            // 告警服务失败不影响主服务
          }

          resolve();
        });

        this.server.on('error', (error) => {
          if (error.code === 'EADDRINUSE') {
            logger.error(`端口 ${this.port} 已被占用`);
          } else {
            logger.error('Web服务器启动失败', error);
          }
          reject(error);
        });
      } catch (error) {
        logger.error('启动Web服务器失败', error);
        reject(error);
      }
    });
  }

  /**
   * 停止服务器
   */
  stop() {
    return new Promise((resolve) => {
      // 🕐 停止倒计时管理器
      if (this.countdownManager) {
        this.countdownManager.stop();
        logger.info('倒计时管理器已停止');
      }

      if (this.server) {
        this.server.close(() => {
          logger.info('Web服务器已关闭');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * 添加告警管理API端点
   */
  setupAlertAPIs() {
    // alertService and alertManager are already imported at the top

    // API: 获取告警历史
    // API: 获取告警历史 (旧版file-based系统，已被数据库版本替代，见line 4279)
    /*
    this.app.get('/api/alerts/history', (req, res) => {
      try {
        const { level, limit, offset } = req.query;
        const result = alertService.getHistory({
          level,
          limit: limit ? parseInt(limit) : undefined,
          offset: offset ? parseInt(offset) : undefined
        });

        // 🔧 使用安全的序列化方法，避免循环引用
        const seen = new WeakSet();
        const safeStringify = (obj) => {
          return JSON.parse(JSON.stringify(obj, (key, value) => {
            // 过滤掉循环引用和复杂对象
            if (typeof value === 'object' && value !== null) {
              if (seen.has(value)) {
                return '[Circular]';
              }
              seen.add(value);

              // 过滤掉特定类型的对象
              if (value.constructor &&
                  (value.constructor.name === 'Pool' ||
                   value.constructor.name === 'Socket' ||
                   value.constructor.name === 'EventEmitter')) {
                return undefined;
              }
            }
            return value;
          }));
        };

        const safeResult = safeStringify(result);

        res.json({
          success: true,
          data: safeResult
        });
      } catch (error) {
        logger.error('获取告警历史失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    */

    // 辅助方法：清理context中的循环引用
    this._sanitizeContext = (context) => {
      if (!context || typeof context !== 'object') return context;

      const sanitized = {};
      for (const [key, value] of Object.entries(context)) {
        try {
          // 只保留基本类型
          if (value === null || value === undefined) {
            sanitized[key] = value;
          } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            sanitized[key] = value;
          } else if (Array.isArray(value)) {
            // 数组只保留基本类型元素
            sanitized[key] = value.filter(v =>
              typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
            ).slice(0, 10);
          } else if (value instanceof Date) {
            sanitized[key] = value.toISOString();
          } else {
            // 其他对象尝试转字符串，失败则忽略
            const str = String(value);
            if (str && str !== '[object Object]' && str.length < 200) {
              sanitized[key] = str;
            }
          }
        } catch (err) {
          // 忽略无法序列化的字段
        }
      }
      return sanitized;
    };

    // API: 获取告警统计
    // API: 获取告警统计 (旧版file-based系统，已被数据库版本替代，见line 4297)
    /*
    this.app.get('/api/alerts/stats', (req, res) => {
      try {
        const { hours = 24 } = req.query;
        const stats = alertService.getStats(parseInt(hours));

        res.json({
          success: true,
          data: stats
        });
      } catch (error) {
        logger.error('获取告警统计失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    */

    // API: 获取所有告警规则 (旧版file-based系统，已被数据库版本替代，见line 4202)
    /*
    this.app.get('/api/alerts/rules', (req, res) => {
      try {
        const rules = alertManager.getRules();

        res.json({
          success: true,
          data: { rules }
        });
      } catch (error) {
        logger.error('获取告警规则失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    */

    // API: 更新告警规则 (旧版file-based系统，已被数据库版本替代，见line 4236)
    /*
    this.app.put('/api/alerts/rules/:ruleId', (req, res) => {
      try {
        const { ruleId } = req.params;
        const updates = req.body;

        alertManager.updateRule(ruleId, updates);

        res.json({
          success: true,
          message: '规则更新成功'
        });
      } catch (error) {
        logger.error('更新告警规则失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    */

    // ⚠️ 以下旧版API已被注释，使用数据库驱动的新版API（见第4215行开始）
    /*
    // API: 测试通知渠道 (旧版，已被数据库版本替代)
    this.app.post('/api/alerts/test/:notifier', async (req, res) => {
      try {
        const { notifier } = req.params;

        await alertService.testNotifier(notifier);

        res.json({
          success: true,
          message: `测试消息已发送到 ${notifier}`
        });
      } catch (error) {
        logger.error(`测试通知渠道失败: ${req.params.notifier}`, error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 手动触发告警 (旧版，已被数据库版本替代)
    this.app.post('/api/alerts/trigger', async (req, res) => {
      try {
        const alert = req.body;

        await alertService.triggerAlert(alert);

        res.json({
          success: true,
          message: '告警已发送'
        });
      } catch (error) {
        logger.error('触发告警失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 清空告警历史 (旧版，已被数据库版本替代)
    this.app.delete('/api/alerts/history', (req, res) => {
      try {
        const count = alertManager.clearHistory();

        res.json({
          success: true,
          message: `已清空 ${count} 条告警历史`
        });
      } catch (error) {
        logger.error('清空告警历史失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 启用/禁用告警系统 (旧版，已被数据库版本替代)
    this.app.put('/api/alerts/enabled', (req, res) => {
      try {
        const { enabled } = req.body;

        alertManager.setEnabled(enabled);

        res.json({
          success: true,
          message: `告警系统已${enabled ? '启用' : '禁用'}`
        });
      } catch (error) {
        logger.error('设置告警状态失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 获取通知渠道配置 (旧版，已被数据库版本替代)
    this.app.get('/api/alerts/config', (req, res) => {
      try {
        const config = alertService.getConfig();

        res.json({
          success: true,
          data: config
        });
      } catch (error) {
        logger.error('获取通知渠道配置失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 保存通知渠道配置 (旧版，已被数据库版本替代)
    this.app.put('/api/alerts/config', async (req, res) => {
      try {
        const config = req.body;

        await alertService.updateConfig(config);

        res.json({
          success: true,
          message: '配置保存成功'
        });
      } catch (error) {
        logger.error('保存通知渠道配置失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    */

    // ============================================================
    // 🧪 测试接口：直接查询数据库（临时调试）
    // ============================================================
    this.app.get('/api/test-db-query', async (req, res) => {
      try {
        const { lotCode = '100003', year = '2025' } = req.query;
        const yearStart = `${year}-01-01`;
        const yearEnd = `${year}-12-31 23:59:59`;

        const pool = database._initPool();
        const [records] = await pool.query(
          `SELECT * FROM lottery_results
           WHERE lot_code = ?
           AND draw_time >= ?
           AND draw_time <= ?
           ORDER BY draw_time DESC
           LIMIT 5`,
          [lotCode, yearStart, yearEnd]
        );

        res.json({
          success: true,
          queryParams: { lotCode, yearStart, yearEnd },
          recordCount: records.length,
          records: records,
          dbConfig: {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            database: process.env.DB_NAME
          }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          stack: error.stack
        });
      }
    });

    // ============================================================
    // 🌐 福彩API域名管理接口（企业版）
    // ============================================================

    // 获取所有域名配置
    this.app.get('/api/cwl/domains', async (req, res) => {
      try {
        const cwlDomainManager = (await import('../managers/CWLDomainManager.js')).default;
        const domains = await cwlDomainManager.getAllDomains();
        const currentDomain = await cwlDomainManager.getBestDomain();

        res.json({
          success: true,
          data: {
            domains: domains,
            currentDomain: currentDomain
          }
        });
      } catch (error) {
        logger.error('获取域名配置失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 获取域名切换历史
    this.app.get('/api/cwl/domains/history', async (req, res) => {
      try {
        const cwlDomainManager = (await import('../managers/CWLDomainManager.js')).default;
        const limit = parseInt(req.query.limit) || 50;
        const history = await cwlDomainManager.getDomainHistory(limit);

        res.json({
          success: true,
          data: history
        });
      } catch (error) {
        logger.error('获取域名切换历史失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 测试域名可用性
    this.app.post('/api/cwl/domains/test', async (req, res) => {
      try {
        const cwlDomainManager = (await import('../managers/CWLDomainManager.js')).default;
        const { domainUrl } = req.body;

        if (!domainUrl) {
          return res.status(400).json({
            success: false,
            error: '域名URL不能为空'
          });
        }

        const result = await cwlDomainManager.testDomain(domainUrl);

        res.json({
          success: result.success,
          data: result
        });
      } catch (error) {
        logger.error('测试域名失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 添加新域名
    this.app.post('/api/cwl/domains', async (req, res) => {
      try {
        const cwlDomainManager = (await import('../managers/CWLDomainManager.js')).default;
        const { domainUrl, domainType, priority } = req.body;

        if (!domainUrl) {
          return res.status(400).json({
            success: false,
            error: '域名URL不能为空'
          });
        }

        const result = await cwlDomainManager.addDomain(
          domainUrl,
          domainType || 'backup',
          priority || 100
        );

        res.json(result);
      } catch (error) {
        logger.error('添加域名失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 更新域名配置
    this.app.put('/api/cwl/domains/:id', async (req, res) => {
      try {
        const cwlDomainManager = (await import('../managers/CWLDomainManager.js')).default;
        const domainId = parseInt(req.params.id);
        const updates = req.body;

        const result = await cwlDomainManager.updateDomain(domainId, updates);

        // 🔥 双向同步：域名管理 → 数据源管理（仅同步主域名）
        if (result.success && updates.domain_url) {
          try {
            // 获取更新后的域名信息
            const allDomains = await cwlDomainManager.getAllDomains();
            const updatedDomain = allDomains.find(d => d.id === domainId);

            // 只有主域名才同步到数据源管理
            if (updatedDomain && updatedDomain.domain_type === 'primary') {
              const sourceId = updatedDomain.source_type;

              // 获取当前数据源配置
              const currentSource = officialSourceManager.getSourceById(sourceId);

              if (currentSource) {
                // 只有URL真的不同时才更新
                if (currentSource.url !== updates.domain_url) {
                  logger.info(`🔗 [同步] 域名管理更新主域名: ${currentSource.url} → ${updates.domain_url}`);

                  await officialSourceManager.updateSourceConfig(sourceId, {
                    url: updates.domain_url
                  });

                  logger.success(`✅ 已同步 ${sourceId} 到数据源配置`);
                } else {
                  logger.debug(`ℹ️ 数据源 ${sourceId} URL未变化，跳过同步`);
                }
              } else {
                logger.warn(`⚠️ 未找到数据源 ${sourceId}，跳过同步`);
              }
            } else {
              logger.debug(`ℹ️ 域名 ID=${domainId} 不是主域名，跳过同步到数据源管理`);
            }
          } catch (error) {
            logger.warn('⚠️ 同步到数据源配置失败，但域名已更新', error.message);
          }
        }

        res.json(result);
      } catch (error) {
        logger.error('更新域名失败', error);
        res.json({
          success: false,
          error: error.message
        });
      }
    });

    // 删除域名
    this.app.delete('/api/cwl/domains/:id', async (req, res) => {
      try {
        const cwlDomainManager = (await import('../managers/CWLDomainManager.js')).default;
        const domainId = parseInt(req.params.id);

        const result = await cwlDomainManager.deleteDomain(domainId);

        res.json(result);
      } catch (error) {
        logger.error('删除域名失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 手动切换域名
    this.app.post('/api/cwl/domains/switch', async (req, res) => {
      try {
        const cwlDomainManager = (await import('../managers/CWLDomainManager.js')).default;
        const { domainId, operator } = req.body;

        if (!domainId) {
          return res.status(400).json({
            success: false,
            error: '域名ID不能为空'
          });
        }

        const result = await cwlDomainManager.switchDomain(
          domainId,
          'manual',
          operator || 'admin'
        );

        res.json(result);
      } catch (error) {
        logger.error('切换域名失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 获取域名健康统计
    this.app.get('/api/cwl/domains/:id/health', async (req, res) => {
      try {
        const cwlDomainManager = (await import('../managers/CWLDomainManager.js')).default;
        const domainId = parseInt(req.params.id);
        const hours = parseInt(req.query.hours) || 24;

        const stats = await cwlDomainManager.getDomainHealthStats(domainId, hours);

        res.json({
          success: true,
          data: stats
        });
      } catch (error) {
        logger.error('获取域名健康统计失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // ========== 数据自动补全 API ==========

    // 自定义补全任务（按彩种或日期）
    this.app.post('/api/data-completion/custom', async (req, res) => {
      try {
        const { lotCodes, year, startDate, endDate } = req.body;
        const dataCompletionService = (await import('../services/DataCompletionService.js')).default;
        const service = dataCompletionService.getInstance();

        if (service.isRunning) {
          return res.status(400).json({
            success: false,
            error: '补全任务正在运行中，请稍后再试'
          });
        }

        // 异步执行自定义补全任务
        service.runCustomCompletion({
          lotCodes,
          year,
          startDate,
          endDate
        }).catch(error => {
          logger.error('[API] 自定义补全任务执行失败:', error);
        });

        res.json({
          success: true,
          message: '自定义补全任务已启动，请稍后查看结果'
        });
      } catch (error) {
        logger.error('启动自定义补全任务失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 手动触发数据补全任务
    this.app.post('/api/data-completion/run', async (req, res) => {
      try {
        const dataCompletionService = (await import('../services/DataCompletionService.js')).default;
        const service = dataCompletionService.getInstance();

        if (service.isRunning) {
          return res.status(400).json({
            success: false,
            error: '补全任务正在运行中，请稍后再试'
          });
        }

        // 异步执行补全任务
        service.runCompletion().catch(error => {
          logger.error('[API] 数据补全任务执行失败:', error);
        });

        res.json({
          success: true,
          message: '数据补全任务已启动，请稍后查看结果'
        });
      } catch (error) {
        logger.error('启动数据补全任务失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 获取数据补全服务状态
    this.app.get('/api/data-completion/status', async (req, res) => {
      try {
        const dataCompletionService = (await import('../services/DataCompletionService.js')).default;
        const service = dataCompletionService.getInstance();
        const stats = service.getStats();

        res.json({
          success: true,
          data: stats
        });
      } catch (error) {
        logger.error('获取数据补全状态失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 获取数据补全历史记录
    this.app.get('/api/data-completion/history', async (req, res) => {
      try {
        const { limit = 20, offset = 0 } = req.query;
        const dataCompletionService = (await import('../services/DataCompletionService.js')).default;
        const service = dataCompletionService.getInstance();
        const history = await service.getHistory({
          limit: parseInt(limit),
          offset: parseInt(offset)
        });

        res.json({
          success: true,
          data: history
        });
      } catch (error) {
        logger.error('获取补全历史失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // ========== 告警管理 API ==========

    // 获取所有告警规则
    this.app.get('/api/alerts/rules', async (req, res) => {
      try {
        // 禁用缓存，确保始终返回最新数据
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        const rules = await this.alertServiceDB.getAllRules();
        res.json({
          success: true,
          data: rules
        });
      } catch (error) {
        logger.error('获取告警规则失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 创建告警规则
    this.app.post('/api/alerts/rules', async (req, res) => {
      try {
        const rule = await this.alertServiceDB.createRule(req.body);
        res.json({
          success: true,
          data: rule
        });
      } catch (error) {
        logger.error('创建告警规则失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 获取单个告警规则详情
    this.app.get('/api/alerts/rules/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const rule = await this.alertServiceDB.getRuleById(parseInt(id));

        if (!rule) {
          return res.status(404).json({
            success: false,
            error: '规则不存在'
          });
        }

        res.json({
          success: true,
          data: rule
        });
      } catch (error) {
        logger.error('获取告警规则详情失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 更新告警规则
    this.app.put('/api/alerts/rules/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const rule = await this.alertServiceDB.updateRule(parseInt(id), req.body);
        res.json({
          success: true,
          data: rule
        });
      } catch (error) {
        logger.error('更新告警规则失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 删除告警规则
    this.app.delete('/api/alerts/rules/:id', async (req, res) => {
      try {
        const { id } = req.params;
        await this.alertServiceDB.deleteRule(parseInt(id));
        res.json({
          success: true,
          message: '删除成功'
        });
      } catch (error) {
        logger.error('删除告警规则失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 获取告警历史
    this.app.get('/api/alerts/history', async (req, res) => {
      try {
        // 禁用缓存，确保始终返回最新数据
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        const { level, status, lotCode, startDate, endDate, limit = 100 } = req.query;
        const history = await this.alertServiceDB.getAlertHistory({
          level,
          status,
          lotCode,
          startDate,
          endDate,
          limit
        });
        res.json({
          success: true,
          data: history
        });
      } catch (error) {
        logger.error('获取告警历史失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 获取告警统计
    this.app.get('/api/alerts/stats', async (req, res) => {
      try {
        // 禁用缓存，确保始终返回最新数据
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        const stats = await this.alertServiceDB.getTodayStats();
        res.json({
          success: true,
          data: stats
        });
      } catch (error) {
        logger.error('获取告警统计失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // ========== 系统设置 API ==========

    this.app.get('/api/settings/system', async (req, res) => {
      try {
        if (!this.settingsService) {
          return res.status(500).json({ success: false, error: '设置服务未初始化' });
        }
        const config = await this.settingsService.getSystemConfig();
        res.json({ success: true, data: config || {} });
      } catch (error) {
        logger.error('获取系统参数失败', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/settings/system', async (req, res) => {
      try {
        if (!this.settingsService) {
          return res.status(500).json({ success: false, error: '设置服务未初始化' });
        }
        const sec = await this.settingsService.getSecurityConfig();
        const requiredToken = sec && sec.adminToken ? sec.adminToken : null;
        const token = req.headers['x-admin-token'] || req.body.adminToken;
        if (requiredToken && token !== requiredToken) {
          return res.status(403).json({ success: false, error: '权限不足' });
        }
        const config = req.body || {};
        await this.settingsService.saveSystemConfig(config);
        res.json({ success: true, message: '系统参数已保存' });
      } catch (error) {
        logger.error('保存系统参数失败', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/settings/security', async (req, res) => {
      try {
        if (!this.settingsService) {
          return res.status(500).json({ success: false, error: '设置服务未初始化' });
        }
        const config = await this.settingsService.getSecurityConfig();
        const data = config
          ? { allowPublicAccess: !!config.allowPublicAccess, adminTokenSet: !!config.adminToken }
          : { allowPublicAccess: true, adminTokenSet: false };
        res.json({ success: true, data });
      } catch (error) {
        logger.error('获取安全设置失败', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/settings/security', async (req, res) => {
      try {
        if (!this.settingsService) {
          return res.status(500).json({ success: false, error: '设置服务未初始化' });
        }
        const current = await this.settingsService.getSecurityConfig();
        const requiredToken = current && current.adminToken ? current.adminToken : null;
        const token = req.headers['x-admin-token'] || req.body.adminTokenVerify;
        if (requiredToken && token !== requiredToken) {
          return res.status(403).json({ success: false, error: '权限不足' });
        }
        const { adminToken, allowPublicAccess } = req.body;
        const newConfig = {};
        if (adminToken !== undefined) newConfig.adminToken = String(adminToken);
        if (allowPublicAccess !== undefined) newConfig.allowPublicAccess = !!allowPublicAccess;
        await this.settingsService.saveSecurityConfig(newConfig);
        res.json({ success: true, message: '安全设置已保存' });
      } catch (error) {
        logger.error('保存安全设置失败', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/settings/database', async (req, res) => {
      try {
        if (!this.settingsService) {
          return res.status(500).json({ success: false, error: '设置服务未初始化' });
        }
        const active = database.getCurrentConfig();
        const saved = await this.settingsService.getDatabaseConfig();
        const safeSaved = saved ? { ...saved, password: saved.password ? '******' : undefined } : null;
        res.json({ success: true, data: { active, saved: safeSaved } });
      } catch (error) {
        logger.error('获取数据库配置失败', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/settings/database', async (req, res) => {
      try {
        if (!this.settingsService) {
          return res.status(500).json({ success: false, error: '设置服务未初始化' });
        }
        const sec = await this.settingsService.getSecurityConfig();
        const requiredToken = sec && sec.adminToken ? sec.adminToken : null;
        const token = req.headers['x-admin-token'] || req.body.adminToken;
        if (requiredToken && token !== requiredToken) {
          return res.status(403).json({ success: false, error: '权限不足' });
        }
        const { host, port, database: dbName, user, password } = req.body;
        if (!host || !dbName || !user) {
          return res.status(400).json({ success: false, error: '请填写完整的数据库配置' });
        }
        const config = { host, port: port ? parseInt(port) : undefined, database: dbName, user, password };
        await this.settingsService.saveDatabaseConfig(config);
        const ok = await database.reinitialize(config);
        res.json({ success: ok, message: ok ? '数据库配置已保存并应用' : '数据库配置已保存，但连接失败' });
      } catch (error) {
        logger.error('保存数据库配置失败', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 触发数据库重新连接（使用当前环境变量或提供的参数）
    this.app.post('/api/database/reconnect', async (req, res) => {
      try {
        const sec = await this.settingsService?.getSecurityConfig();
        const requiredToken = sec && sec.adminToken ? sec.adminToken : null;
        const token = req.headers['x-admin-token'] || req.body?.adminToken;
        if (requiredToken && token !== requiredToken) {
          return res.status(403).json({ success: false, error: '权限不足' });
        }
        const config = req.body || {};
        const ok = await database.reinitialize(config);
        res.json({ success: ok, message: ok ? '数据库已重新连接' : '数据库重新连接失败' });
      } catch (error) {
        logger.error('数据库重新连接失败', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 获取SMTP配置
    this.app.get('/api/settings/smtp', async (req, res) => {
      try {
        if (!this.settingsService) {
          return res.status(500).json({
            success: false,
            error: '设置服务未初始化'
          });
        }

        const config = await this.settingsService.getSMTPConfig();
        res.json({
          success: true,
          data: config || null
        });
      } catch (error) {
        logger.error('获取SMTP配置失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 保存SMTP配置
    this.app.post('/api/settings/smtp', async (req, res) => {
      try {
        if (!this.settingsService) {
          return res.status(500).json({
            success: false,
            error: '设置服务未初始化'
          });
        }

        const { host, port, user, pass } = req.body;

        // 验证必填字段
        if (!host || !port || !user || !pass) {
          return res.status(400).json({
            success: false,
            error: '请填写完整的SMTP配置'
          });
        }

        await this.settingsService.saveSMTPConfig({
          host,
          port: parseInt(port),
          user,
          pass
        });

        // 清除告警服务中的SMTP配置缓存，下次发送邮件时会重新加载
        if (this.alertServiceDB) {
          this.alertServiceDB.smtpConfig = null;
          this.alertServiceDB.emailTransporter = null;
        }

        logger.success(`⚙️ SMTP配置已更新: ${user}@${host}:${port}`);

        res.json({
          success: true,
          message: 'SMTP配置已保存'
        });
      } catch (error) {
        logger.error('保存SMTP配置失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 测试SMTP配置
    this.app.post('/api/settings/smtp/test', async (req, res) => {
      try {
        if (!this.alertServiceDB) {
          return res.status(500).json({
            success: false,
            error: '告警服务未初始化'
          });
        }

        const { email } = req.body;
        if (!email) {
          return res.status(400).json({
            success: false,
            error: '请提供测试邮箱地址'
          });
        }

        // 创建测试告警数据
        const testRule = {
          name: 'SMTP配置测试',
          level: 'info',
          notification_config: { email }
        };

        const testAlert = {
          message: '这是一封测试邮件，用于验证SMTP配置是否正确',
          lot_name: '系统测试',
          metric_value: '测试',
          timestamp: new Date()
        };

        // 发送测试邮件
        await this.alertServiceDB.sendEmailNotification(testRule, testAlert);

        logger.success(`📧 测试邮件已发送至: ${email}`);

        res.json({
          success: true,
          message: '测试邮件已发送，请检查邮箱'
        });
      } catch (error) {
        logger.error('发送测试邮件失败', error);
        res.status(500).json({
          success: false,
          error: error.message || '发送失败'
        });
      }
    });

    // 获取配置历史
    this.app.get('/api/settings/history', async (req, res) => {
      try {
        if (!this.settingsService) {
          return res.status(500).json({
            success: false,
            error: '设置服务未初始化'
          });
        }

        const history = await this.settingsService.getHistory(20);
        res.json({
          success: true,
          data: history
        });
      } catch (error) {
        logger.error('获取配置历史失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // ==================== 钉钉配置 ====================

    // 获取钉钉配置
    this.app.get('/api/settings/dingtalk', async (req, res) => {
      try {
        if (!this.settingsService) {
          return res.status(500).json({
            success: false,
            error: '设置服务未初始化'
          });
        }

        const config = await this.settingsService.getDingTalkConfig();
        res.json({
          success: true,
          data: config || { webhook: '', secret: '' }
        });
      } catch (error) {
        logger.error('获取钉钉配置失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 保存钉钉配置
    this.app.post('/api/settings/dingtalk', async (req, res) => {
      try {
        if (!this.settingsService) {
          return res.status(500).json({
            success: false,
            error: '设置服务未初始化'
          });
        }

        const { webhook, secret } = req.body;

        // 验证webhook必填
        if (!webhook || webhook.trim() === '') {
          return res.status(400).json({
            success: false,
            error: '钉钉Webhook地址不能为空'
          });
        }

        // 验证webhook格式（必须是钉钉官方域名）
        if (!webhook.startsWith('https://oapi.dingtalk.com/robot/send?access_token=')) {
          return res.status(400).json({
            success: false,
            error: '钉钉Webhook地址格式不正确，应为: https://oapi.dingtalk.com/robot/send?access_token=...'
          });
        }

        await this.settingsService.saveDingTalkConfig({ webhook, secret });

        res.json({
          success: true,
          message: '钉钉配置已保存'
        });
      } catch (error) {
        logger.error('保存钉钉配置失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 测试钉钉通知
    this.app.post('/api/settings/dingtalk/test', async (req, res) => {
      try {
        if (!this.settingsService) {
          return res.status(500).json({
            success: false,
            error: '设置服务未初始化'
          });
        }

        const config = await this.settingsService.getDingTalkConfig();
        if (!config || !config.webhook) {
          return res.status(400).json({
            success: false,
            error: '钉钉配置不完整，请先配置Webhook地址'
          });
        }

        // 发送测试消息
        const axios = (await import('axios')).default;
        const message = {
          msgtype: 'markdown',
          markdown: {
            title: '🔔 测试通知',
            text: `### 🔔 钉钉通知测试\n\n` +
                  `**测试时间**: ${new Date().toLocaleString('zh-CN')}\n\n` +
                  `**消息来源**: 彩票爬虫告警系统\n\n` +
                  `如果您收到此消息，说明钉钉通知配置成功！`
          }
        };

        await axios.post(config.webhook, message);

        res.json({
          success: true,
          message: '测试消息已发送，请检查钉钉群'
        });
      } catch (error) {
        logger.error('发送钉钉测试消息失败', error);
        res.status(500).json({
          success: false,
          error: `发送失败: ${error.message}`
        });
      }
    });

    // ==================== 企业微信配置 ====================

    // 获取企业微信配置
    this.app.get('/api/settings/wechat', async (req, res) => {
      try {
        if (!this.settingsService) {
          return res.status(500).json({
            success: false,
            error: '设置服务未初始化'
          });
        }

        const config = await this.settingsService.getWeChatConfig();
        res.json({
          success: true,
          data: config || { webhook: '' }
        });
      } catch (error) {
        logger.error('获取企业微信配置失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 保存企业微信配置
    this.app.post('/api/settings/wechat', async (req, res) => {
      try {
        if (!this.settingsService) {
          return res.status(500).json({
            success: false,
            error: '设置服务未初始化'
          });
        }

        const { webhook } = req.body;

        // 验证webhook必填
        if (!webhook || webhook.trim() === '') {
          return res.status(400).json({
            success: false,
            error: '企业微信Webhook地址不能为空'
          });
        }

        // 验证webhook格式（必须是企业微信官方域名）
        if (!webhook.startsWith('https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=')) {
          return res.status(400).json({
            success: false,
            error: '企业微信Webhook地址格式不正确，应为: https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...'
          });
        }

        await this.settingsService.saveWeChatConfig({ webhook });

        res.json({
          success: true,
          message: '企业微信配置已保存'
        });
      } catch (error) {
        logger.error('保存企业微信配置失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 测试企业微信通知
    this.app.post('/api/settings/wechat/test', async (req, res) => {
      try {
        if (!this.settingsService) {
          return res.status(500).json({
            success: false,
            error: '设置服务未初始化'
          });
        }

        const config = await this.settingsService.getWeChatConfig();
        if (!config || !config.webhook) {
          return res.status(400).json({
            success: false,
            error: '企业微信配置不完整，请先配置Webhook地址'
          });
        }

        // 发送测试消息
        const axios = (await import('axios')).default;
        const message = {
          msgtype: 'markdown',
          markdown: {
            content: `### 🔔 企业微信通知测试\n\n` +
                    `**测试时间**: ${new Date().toLocaleString('zh-CN')}\n\n` +
                    `**消息来源**: 彩票爬虫告警系统\n\n` +
                    `如果您收到此消息，说明企业微信通知配置成功！`
          }
        };

        await axios.post(config.webhook, message, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10秒超时
        });

        res.json({
          success: true,
          message: '测试消息已发送，请检查企业微信群'
        });
      } catch (error) {
        logger.error('发送企业微信测试消息失败', error);
        res.status(500).json({
          success: false,
          error: `发送失败: ${error.message}`
        });
      }
    });

    // ==================== Webhook配置 ====================

    // 获取Webhook配置
    this.app.get('/api/settings/webhook', async (req, res) => {
      try {
        if (!this.settingsService) {
          return res.status(500).json({
            success: false,
            error: '设置服务未初始化'
          });
        }

        const config = await this.settingsService.getWebhookConfig();
        res.json({
          success: true,
          data: config || { url: '' }
        });
      } catch (error) {
        logger.error('获取Webhook配置失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 保存Webhook配置
    this.app.post('/api/settings/webhook', async (req, res) => {
      try {
        if (!this.settingsService) {
          return res.status(500).json({
            success: false,
            error: '设置服务未初始化'
          });
        }

        const { url } = req.body;

        // 验证URL必填
        if (!url || url.trim() === '') {
          return res.status(400).json({
            success: false,
            error: 'Webhook URL不能为空'
          });
        }

        // 验证URL格式
        try {
          new URL(url);
        } catch (e) {
          return res.status(400).json({
            success: false,
            error: 'Webhook URL格式不正确'
          });
        }

        await this.settingsService.saveWebhookConfig({ url });

        res.json({
          success: true,
          message: 'Webhook配置已保存'
        });
      } catch (error) {
        logger.error('保存Webhook配置失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 测试Webhook通知
    this.app.post('/api/settings/webhook/test', async (req, res) => {
      try {
        if (!this.settingsService) {
          return res.status(500).json({
            success: false,
            error: '设置服务未初始化'
          });
        }

        const config = await this.settingsService.getWebhookConfig();
        if (!config || !config.url) {
          return res.status(400).json({
            success: false,
            error: 'Webhook配置不完整，请先配置Webhook URL'
          });
        }

        // 发送测试消息
        const axios = (await import('axios')).default;
        const payload = {
          type: 'test',
          message: 'Webhook通知测试',
          timestamp: new Date().toISOString(),
          data: {
            test_time: new Date().toLocaleString('zh-CN'),
            source: '彩票爬虫告警系统'
          }
        };

        await axios.post(config.url, payload);

        res.json({
          success: true,
          message: '测试消息已发送'
        });
      } catch (error) {
        logger.error('发送Webhook测试消息失败', error);
        res.status(500).json({
          success: false,
          error: `发送失败: ${error.message}`
        });
      }
    });
  }
}

export default WebServer;
