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

module.exports.parallelBulkWrite = async (Model, operations, batchSize = 100) => {
    for(let i = 0; i < operations.length; i += batchSize) {
        const batch = operations.slice(i, i + batchSize);
        if (batch.length) {
            await Model.bulkWrite(batch)
       }
   }
}