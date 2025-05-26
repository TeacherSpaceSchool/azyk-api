const StockAzyk = require('../models/stockAzyk');
const HistoryStockAzyk = require('../models/historyStockAzyk');
const OrderAzyk = require('../models/orderAzyk');
const DistrictAzyk = require('../models/districtAzyk');

module.exports.calculateStock = async(orders, organization, client) => {
    const warehouse = (await DistrictAzyk.findOne({organization, client}).select('warehouse').lean()).warehouse
    orders = await OrderAzyk.find({_id: {$in: orders}}).select('_id item count status').lean()
    for(let i=0; i<orders.length; i++) {
        const stockAzyk = await StockAzyk.findOne({item: orders[i].item, warehouse})
        if(stockAzyk) {
            //старый
            const historyStockAzyk = await HistoryStockAzyk.findOne({order: orders[i]._id, item: orders[i].item}).lean()
            if (historyStockAzyk) {
                stockAzyk.count += historyStockAzyk.count
                await HistoryStockAzyk.deleteOne({_id: historyStockAzyk._id})
            }
            //новый
            if (!['отмена', 'обработка'].includes(orders[i].status)) {
                stockAzyk.count -= orders[i].count
                let _object = new HistoryStockAzyk({
                    item: orders[i].item,
                    order: orders[i]._id,
                    count: orders[i].count
                });
                await HistoryStockAzyk.create(_object)
            }
            //сохранение
            await stockAzyk.save()
        }
    }
}