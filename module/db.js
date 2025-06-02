const OrderAzyk = require('../models/orderAzyk');
const InvoiceAzyk = require('../models/invoiceAzyk');
const HistoryOrderAzyk = require('../models/historyOrderAzyk');
const RouteAzyk = require('../models/routeAzyk');
const OutXMLShoroAzyk = require('../models/integrate/shoro/outXMLShoroAzyk');
const SingleOutXMLAzyk = require('../models/singleOutXMLAzyk');

module.exports.reductionOldestDB = async() => {
    let date = new Date('2024-01-01T03:00:00.000Z')
    console.log('reductionOldestDB start')

    console.log('OrderAzyk delete:', await OrderAzyk.deleteMany({createdAt: {$lte: date}}))
    console.log('InvoiceAzyk delete:', await InvoiceAzyk.deleteMany({createdAt: {$lte: date}}))
    console.log('RouteAzyk delete:', await RouteAzyk.deleteMany({createdAt: {$lte: date}}))
    console.log('HistoryOrderAzyk delete:', await HistoryOrderAzyk.deleteMany({createdAt: {$lte: date}}))
    console.log('OutXMLShoroAzyk delete:', await OutXMLShoroAzyk.deleteMany({createdAt: {$lte: date}}))
    console.log('SingleOutXMLAzyk delete:', await SingleOutXMLAzyk.deleteMany({createdAt: {$lte: date}}))
/*
    const orders = await OrderAzyk.find({createdAt: {$lte: date}}).distinct('_id').lean()
    const invoices = await InvoiceAzyk.find({orders: {$in: orders}}).distinct('_id').lean()
    console.log('OrderAzyk delete:', await OrderAzyk.countDocuments({_id: {$in: orders}}))
    console.log('InvoiceAzyk delete:', await InvoiceAzyk.countDocuments({_id: {$in: invoices}}))
    console.log('RouteAzyk delete:', await RouteAzyk.countDocuments({selectedOrders: {$in: invoices}}))
    console.log('HistoryOrderAzyk delete:', await HistoryOrderAzyk.countDocuments({invoice: {$in: invoices}}))
    console.log('OutXMLShoroAzyk delete:', await OutXMLShoroAzyk.countDocuments({invoice: {$in: invoices}}))
    console.log('SingleOutXMLAzyk delete:', await SingleOutXMLAzyk.countDocuments({invoice: {$in: invoices}}))
*/
    console.log('reductionOldestDB end')
}