import { appendFileSync, createWriteStream, existsSync, mkdirSync, renameSync, unlinkSync } from 'fs';
import { resolve, join } from 'path';
import { getHeapSnapshot } from 'v8';
import { defineNitroPlugin } from "nitropack/runtime";

const IS_HEAP_PROFILER_ENABLED = true;

const ONE_MINUTE_MS = 1000 * 60;
const ONE_HOUR_MS = ONE_MINUTE_MS * 60;

const SNAPSHOT_DIR = resolve('.snapshots');
const LOG_FILE = join(SNAPSHOT_DIR, 'log.txt');

// 24h
const SNAPSHOT_LIFETIME = ONE_HOUR_MS * 24;
// 5m
const FIRST_SNAPSHOT_TIMEOUT = ONE_MINUTE_MS * 5;
// 4h
const SNAPSHOT_INTERVAL = ONE_HOUR_MS * 4;

const log = (message: string) => {
    const timestamp = new Date().toISOString();
    mkdirSync(SNAPSHOT_DIR, { recursive: true });
    appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
    console.info(`[${timestamp}] ${message}\n`);
};

const writeHeapSnapshot = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}.heapsnapshot`;
    const filePath = join(SNAPSHOT_DIR, filename);
    const tempPath = filePath + '.tmp';

    const snapshotStream = getHeapSnapshot();
    const writeStream = createWriteStream(tempPath);

    snapshotStream.pipe(writeStream);

    writeStream.on('finish', () => {
        renameSync(tempPath, filePath);
        log(`Heap snapshot saved: /snapshots/${filename}`);
        scheduleDeletion(filePath, filename);
    });

    writeStream.on('error', (err) => {
        log(`ERROR writing heap snapshot: ${err.message}`);
    });
};

/**
 * @description
 * Удаление старых снимков памяти
 */
const scheduleDeletion = (filePath: string, filename: string) => {
    setTimeout(() => {
        try {
            if (existsSync(filePath)) {
                unlinkSync(filePath);
                log(`Deleted: ${filename}`);
            }
        } catch (err: any) {
            log(`ERROR deleting ${filename}: ${err.message}`);
        }
    }, SNAPSHOT_LIFETIME);
};

export default defineNitroPlugin(() => {
    if (!IS_HEAP_PROFILER_ENABLED) {
        return;
    }

    log('Heap profiler started');
    /**
     * @description
     * Выполняется один раз спустя некоторое время,
     * чтобы успела произойти инициализация node-server
     */
    setTimeout(writeHeapSnapshot, FIRST_SNAPSHOT_TIMEOUT);
    /**
     * @description
     * Выполняется интервально,
     * чтобы можно было сравнить рост потребления памяти во времени
     */
    setInterval(writeHeapSnapshot, SNAPSHOT_INTERVAL);
});
