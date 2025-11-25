const InvoiceAzyk = require('../models/invoiceAzyk');
const OrderAzyk = require('../models/orderAzyk');

const dates = [
    new Date('2020-01-01T03:00:00.000Z'),
    new Date('2020-04-01T03:00:00.000Z'),
    new Date('2020-07-01T03:00:00.000Z'),
    new Date('2020-10-01T03:00:00.000Z'),
    new Date('2021-01-01T03:00:00.000Z'),
    new Date('2021-04-01T03:00:00.000Z'),
    new Date('2021-07-01T03:00:00.000Z'),
    new Date('2021-10-01T03:00:00.000Z'),
    new Date('2022-01-01T03:00:00.000Z'),
    new Date('2022-04-01T03:00:00.000Z'),
    new Date('2022-07-01T03:00:00.000Z'),
    new Date('2022-10-01T03:00:00.000Z'),
    new Date('2023-01-01T03:00:00.000Z'),
    new Date('2023-04-01T03:00:00.000Z'),
    new Date('2023-07-01T03:00:00.000Z'),
    new Date('2023-10-01T03:00:00.000Z'),
    new Date('2024-01-01T03:00:00.000Z'),
    new Date('2024-04-01T03:00:00.000Z'),
    new Date('2024-07-01T03:00:00.000Z'),
    new Date('2024-10-01T03:00:00.000Z'),
    new Date('2025-01-01T03:00:00.000Z'),
    new Date('2025-04-01T03:00:00.000Z'),
    new Date('2025-07-01T03:00:00.000Z'),
    new Date('2025-10-01T03:00:00.000Z'),
    new Date('2026-01-01T03:00:00.000Z'),
]

module.exports.reductionOrderAzyk = async () => {
    console.time('reductionOrderAzyk')
    for(let idx=0; idx<dates.length; idx++) {
        const createdAtFilter = {createdAt: {$gte: dates[idx], ...dates[idx+1]?{$lt: dates[idx+1]}:{}}}
        if(await InvoiceAzyk.countDocuments({rejectedPrice: null, ...createdAtFilter})) {
            console.log(`reductionInvoiceAzyk ${idx+1}/${dates.length}`, (await InvoiceAzyk.updateMany({rejectedPrice: null, ...createdAtFilter}, {rejectedPrice: 0})).nModified)
            console.log(`reductionOrderAzyk ${idx+1}/${dates.length}`, (await OrderAzyk.updateMany({rejected: null, ...createdAtFilter}, {rejected: 0})).nModified)
        }
    }
    console.timeEnd('reductionOrderAzyk')
}