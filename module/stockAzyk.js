const StockAzyk = require('../models/stockAzyk');
const HistoryStockAzyk = require('../models/historyStockAzyk');
const OrderAzyk = require('../models/orderAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const {parallelPromise} = require('./parallel');

module.exports.calculateStock = async(orderIds, organizationId, clientId) => {
    // eslint-disable-next-line no-undef
    const [district, orders] = await Promise.all([
        DistrictAzyk.findOne({organization: organizationId, client: clientId}).select('warehouse').lean(),
        OrderAzyk.find({_id: {$in: orderIds}}).select('_id item count status').lean()
    ])
    const warehouse = district.warehouse
    // eslint-disable-next-line no-undef
    await parallelPromise(orders, async order => {
        const stockAzyk = await StockAzyk.findOne({item: order.item, warehouse, unlimited: {$ne: true}})
        if(stockAzyk) {
            //старый
            const historyStockAzyk = await HistoryStockAzyk.findOne({order: order._id, item: order.item}).lean()
            if (historyStockAzyk) {
                stockAzyk.count += historyStockAzyk.count
                await HistoryStockAzyk.deleteOne({_id: historyStockAzyk._id})
           }
            //новый
            if (order.status!=='отмена'&&order.count) {
                stockAzyk.count -= order.count
                await HistoryStockAzyk.create({
                    item: order.item,
                    order: order._id,
                    count: order.count
               })
           }
            //сохранение
            await stockAzyk.save()
       }
   })
}