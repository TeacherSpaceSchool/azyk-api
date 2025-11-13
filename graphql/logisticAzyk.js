const InvoiceAzyk = require('../models/invoiceAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const OrderAzyk = require('../models/orderAzyk');
const ItemAzyk = require('../models/itemAzyk');
const {checkFloat, dayStartDefault} = require('../module/const');
const ReturnedAzyk = require('../models/returnedAzyk');
const StockAzyk = require('../models/stockAzyk');
const ConsigFlowAzyk = require('../models/consigFlowAzyk');

const type = `
  type FinanceReport {
    invoices: [Invoice]
    returneds: [Returned]
 }
`;

const query = `
    financeReport(organization: ID!, track: Int, forwarder: ID!, dateDelivery: Date!): FinanceReport
    summaryInvoice(organization: ID!, track: Int!, forwarder: ID!, dateDelivery: Date!): [[String]]
`;

const resolvers = {
    financeReport: async(parent, {organization, forwarder, dateDelivery, track}, {user}) =>  {
        if(['суперорганизация', 'организация', 'admin', 'менеджер'].includes(user.role)) {
            //если пользователь экспедитор
            if(user.role==='экспедитор') forwarder = user.employment
            //dateDelivery
            dateDelivery.setHours(dayStartDefault, 0, 0, 0)
            // eslint-disable-next-line no-undef
            const forwarderClients = await DistrictAzyk.find({forwarder}).distinct('client');
            if(user.organization) organization = user.organization
            const invoices = await InvoiceAzyk.find({
                /*не удален*/del: {$ne: 'deleted'}, /*экспедитор*/$or: [{forwarder}, {forwarder: null, client: {$in: forwarderClients}}],
                /*рейс*/...track?{track}:{}, /*dateDelivery*/dateDelivery, /*organization*/organization, /*только принят*/taken: true
            }).select('_id createdAt number client agent allPrice address track info discount paymentMethod inv orders')
                .populate({path: 'orders', populate: {path: 'item', select: '_id name packaging'}}).populate({path: 'client', select: '_id name inn phone'}).sort('createdAt').lean()
            //invoicesClients
            const invoicesClients = invoices.map(invoice => invoice.client)
            //консигнации
            // eslint-disable-next-line no-undef
            const [consigFlows, returneds] = await Promise.all([
                ConsigFlowAzyk.find({
                    /*organization*/organization, /*dateDelivery*/createdAt: {$lte: dateDelivery},
                    /*клиенты заказа*/client: {$in: invoicesClients}, /*не отмена*/cancel: {$ne: true},
                }).select('client amount sign').sort('createdAt').lean(),
                ReturnedAzyk.find({
                    /*не удален*/del: {$ne: 'deleted'}, /*рейс*/...track?{track}:{}, /*dateDelivery*/dateDelivery, /*organization*/organization,
                    /*только принят*/confirmationForwarder: true, /*экспедитор*/$or: [{forwarder}, {forwarder: null, client: {$in: forwarderClients}}]
                }).select('_id createdAt items number client agent allPrice address track info')
                    .populate({path: 'client', select: '_id name inn phone'}).sort('createdAt').lean()
            ])
            //returnedByClient
            const returnedByClient = {}
            for(const returned of returneds) {
                const clientId = returned.client._id.toString()
                returnedByClient[clientId] = checkFloat((returnedByClient[clientId] || 0) + returned.allPrice)
            }
            //consigByClient
            const consigByClient = {}
            for(const consigFlow of consigFlows) {
                const clientId = consigFlow.client.toString()
                consigByClient[clientId] = checkFloat((consigByClient[clientId] || 0) + (consigFlow.amount * consigFlow.sign))
            }
            //sort
            let sortedInvoices = {}
            for(const invoice of invoices) {
                const clientId = invoice.client._id.toString()
                if(returnedByClient[clientId]) {
                    invoice.returned = returnedByClient[clientId]
                    delete returnedByClient[clientId]
                }
                if(consigByClient[clientId]) {
                    invoice.consig = consigByClient[clientId]
                    delete consigByClient[clientId]
                }
                if(!sortedInvoices[clientId]) sortedInvoices[clientId] = []
                sortedInvoices[clientId].push(invoice)
            }
            return {invoices: Object.values(sortedInvoices).flat(), returneds}
        }
    },
    summaryInvoice: async(parent, {organization, forwarder, dateDelivery, track}, {user}) =>  {
        if(['суперорганизация', 'организация', 'admin', 'менеджер'].includes(user.role)) {
            //если пользователь экспедитор
            if(user.role==='экспедитор') forwarder = user.employment
            //dateDelivery
            dateDelivery.setHours(dayStartDefault, 0, 0, 0)
            const forwarderClients = await DistrictAzyk.find({forwarder}).distinct('client');
            if(user.organization) organization = user.organization
            let orders = await InvoiceAzyk.find({
                //не удален
                del: {$ne: 'deleted'},
                //экспедитор
                $or: [{forwarder}, {forwarder: null, client: {$in: forwarderClients}}],
                //рейс
                track,
                //dateDelivery
                dateDelivery,
                //organization
                organization,
                //только принят
                taken: true
            }).distinct('orders')
            orders = await OrderAzyk.find({_id: {$in: orders}}).lean()
            // eslint-disable-next-line no-undef
            const [items, districts, stocks] = await Promise.all([
                ItemAzyk.find({_id: {$in: orders.map(order => order.item)}}).lean(),
                DistrictAzyk.find({client: {$in: orders.map(order => order.client)}}).lean(),
                StockAzyk.find({organization}).lean()
            ])
            //itemById
            const itemById = {}
            for(const item of items) {
                const itemId = item._id.toString()
                itemById[itemId] = item
            }
            //logisticNameByWarehouseItem
            const logisticNameByWarehouseItem = {}
            for(const stock of stocks) {
                const warehouse = stock.warehouse||null
                logisticNameByWarehouseItem[`${warehouse}${stock.item}`] = stock.logisticName
            }
            //warehouseByClientAgent
            const agentByClient = {}
            const warehouseByClientAgent = {}
            for(const district of districts)
                for(const client of district.client) {
                    const clientId = client.toString()
                    warehouseByClientAgent[`${clientId}${district.agent}`] = district.warehouse||null
                    if(!agentByClient[client]) agentByClient[clientId] = district.agent||null
                }
            //summaryInvoiceByItemWarehouse
            let summaryInvoiceByItemWarehouse = {}
            for(const order of orders) {
                const itemId = order.item.toString()
                const item = itemById[itemId]
                const clientId = order.client.toString()
                const agent = agentByClient[clientId]
                const warehouse = warehouseByClientAgent[`${order.client}${agent}`]||null
                const logisticName = logisticNameByWarehouseItem[`${warehouse}${order.item}`]||'Не указан'
                const itemLogisticName = `${item._id}${logisticName}`
                const count = order.count - order.returned
                const allPrice = checkFloat(order.allPrice/order.count*count)
                if(!summaryInvoiceByItemWarehouse[itemLogisticName])
                    summaryInvoiceByItemWarehouse[itemLogisticName] = {
                        logisticName,
                        item,
                        count: 0,
                        allPrice: 0,
                        allTonnage: 0
                    }
                summaryInvoiceByItemWarehouse[itemLogisticName].count += count
                summaryInvoiceByItemWarehouse[itemLogisticName].allPrice += allPrice
                summaryInvoiceByItemWarehouse[itemLogisticName].allTonnage += order.allTonnage
            }
            let summaryInvoice = Object.values(summaryInvoiceByItemWarehouse)
            summaryInvoice = summaryInvoice.sort((a, b) => (b.item.priotiry||0) - (a.item.priotiry||0))
            summaryInvoice = summaryInvoice.sort((a, b) => a.logisticName.localeCompare(b.logisticName))
            summaryInvoice = summaryInvoice.map(summaryInvoiceElement => [
                summaryInvoiceElement.logisticName, summaryInvoiceElement.item.name, checkFloat(summaryInvoiceElement.count),
                checkFloat(summaryInvoiceElement.count/summaryInvoiceElement.item.packaging), checkFloat(summaryInvoiceElement.allPrice),
                checkFloat(summaryInvoiceElement.allTonnage)
            ])
            return summaryInvoice
        }
    }
};

module.exports.query = query;
module.exports.resolvers = resolvers;
module.exports.type = type;