const OrderAzyk = require('../models/orderAzyk');

const incrementStocks = async (orders) => {
    orders = await OrderAzyk.find({_id: {$in: orders}}).select('item count returned').lean()
}