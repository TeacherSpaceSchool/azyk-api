const InvoiceAzyk = require('../models/invoiceAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const OrderAzyk = require('../models/orderAzyk');
const ItemAzyk = require('../models/itemAzyk');
const {checkFloat, dayStartDefault, getClientTitle, pdDDMMHHMM} = require('../module/const');
const ReturnedAzyk = require('../models/returnedAzyk');
const StockAzyk = require('../models/stockAzyk');

const query = `
    financeReport(organization: ID!, track: Int, forwarder: ID!, dateDelivery: Date!): [[String]]
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
            const filter = {
                //не удален
                del: {$ne: 'deleted'},
                //экспедитор
                $or: [{forwarder}, {forwarder: null, client: {$in: forwarderClients}}],
                //рейс
                ...track?{track}:{},
                //dateDelivery
                dateDelivery,
                //organization
                organization
            }
            // eslint-disable-next-line no-undef
            const [invoices, returneds] = await Promise.all([
                InvoiceAzyk.find({
                    ...filter,
                    //только принят
                    taken: true
                }).select('_id createdAt client agent allPrice address track info discount returnedPrice paymentMethod inv').sort('createdAt').lean(),
                ReturnedAzyk.find({
                    ...filter,
                    //только принят
                    confirmationForwarder: true
                }).select('client allPrice').lean()
            ])
            //returnedByClient
            const returnedByClient = {}
            for(const returned of returneds)
                returnedByClient[returned.client] = checkFloat(returnedByClient[returned.client]||0 + returned.allPrice)
            // eslint-disable-next-line no-undef
            let sortedInvoices = new Map()
            for(const invoice of invoices) {
                invoice.returned = returnedByClient[invoice.client]
                if(!sortedInvoices.has(invoice.client)) sortedInvoices.set(invoice.client, [])
                sortedInvoices.get(invoice.client).push(invoice)
            }
            sortedInvoices = Array.from(sortedInvoices.values()).flat().map(invoice => [
                getClientTitle({address: [invoice.address]}), invoice.allPrice - invoice.returnedPrice, ['Наличные'].includes(invoice.paymentMethod)?invoice.allPrice - invoice.returnedPrice:0,
                invoice.paymentMethod, invoice.returned, invoice.inv===0?'нет':'да', `${invoice.agent?'Агент:':'Онлайн:'} ${pdDDMMHHMM(invoice.createdAt)}\n${invoice.info}`
            ])
            return sortedInvoices
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
            for(const item of items)
                itemById[item._id] = item
            //logisticNameByWarehouseItem
            const logisticNameByWarehouseItem = {}
            for(const stock of stocks)
                logisticNameByWarehouseItem[`${stock.warehouse}${stock.item}`] = stock.logisticName
            //warehouseByClientAgent
            const warehouseByClientAgent = {}
            for(const district of districts)
                for(const client of district.client) {
                    warehouseByClientAgent[`${client}${district.agent}`] = district.warehouse
                }
            //summaryInvoiceByItemWarehouse
            let summaryInvoiceByItemWarehouse = {}
            for(const order of orders) {
                const item = itemById[order.item]
                const warehouse = warehouseByClientAgent[`${order.client}${order.agent}`]
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