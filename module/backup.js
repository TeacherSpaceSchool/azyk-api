const mongoose = require('mongoose');
const app = require('../app');
const path = require('path');
const fs = require('fs');

const pathIncrementalDump = path.join(app.dirname, 'backup', 'incremental.ldjson');

const lastIncrementalDumpDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

module.exports.dumpDB = async () => {
    console.log('start dumpDB')
    console.time('dumpDB')
    let collectionsInfo = await mongoose.connection.db.listCollections().toArray()
    collectionsInfo = collectionsInfo.filter(collectionInfo => collectionInfo.name.includes('azyk'))
    const stream = fs.createWriteStream(pathIncrementalDump, { flags: 'a' });
    let count = 0
    for (const {name} of collectionsInfo) {
        const cursor = mongoose.connection.db.collection(name).find({ updatedAt: { $gt: lastIncrementalDumpDate } });
        while (await cursor.hasNext()) {
            const doc = await cursor.next();
            stream.write(JSON.stringify({ collection: name, data: doc }) + '\n');
            count += 1
        }
    }
    stream.end();
    console.timeEnd('dumpDB')
    console.log('end dumpDB', count)
}