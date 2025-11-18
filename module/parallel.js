module.exports.parallelPromise = async (list, workerFn, concurrency = 10) => {
    let index = 0;
    const results = new Array(list.length); // заранее создаём массив нужного размера
    async function worker() {
        while (index < list.length) {
            const currentIndex = index++;
            results[currentIndex] = await workerFn(list[currentIndex], currentIndex);
       }
   }
    // eslint-disable-next-line no-undef
    await Promise.all(Array(concurrency).fill().map(() => worker()));
    return results; // возвращаем список результатов
}

const cleaneOperations = operations => operations.filter(op => {
    const key = Object.keys(op)[0]; // updateOne / updateMany / insertOne

    // updateOne / updateMany — проверяем update.$set и фильтр
    if (key === 'updateOne' || key === 'updateMany') {
        const f = op[key].filter;
        const u = op[key].update;

        // Проверка что фильтр не пуст
        if (!f || Object.keys(f).length === 0) return false;

        // Проверка что update не пуст и $set не пуст
        if (!u || Object.keys(u).length === 0) return false;
        if (u.$set && Object.keys(u.$set).length === 0) return false;

        return true;
    }

    // insertOne — проверяем что документ не пуст
    if (key === 'insertOne') {
        const doc = op[key].document || op[key];
        if (!doc || Object.keys(doc).length === 0) return false;
        return true;
    }

    // Если операция неизвестная — не включаем
    return false;
});

module.exports.parallelBulkWrite = async (Model, operations, batchSize = 100) => {
    for(let i = 0; i < operations.length; i += batchSize) {
        const batch = cleaneOperations(operations.slice(i, i + batchSize));
        if (batch.length) {
            await Model.bulkWrite(cleaneOperations(batch))
       }
   }
}