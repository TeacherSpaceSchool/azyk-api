const InvoiceAzyk = require('../models/invoiceAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const OrderAzyk = require('../models/orderAzyk');
const ItemAzyk = require('../models/itemAzyk');
const {checkFloat, dayStartDefault, getClientTitle, pdDDMMYYYY, sum, isEmpty, isNotEmpty} = require('../module/const');
const ReturnedAzyk = require('../models/returnedAzyk');
const StockAzyk = require('../models/stockAzyk');
const {getExcelSheet, horizontalAlignments} = require('../module/excel');
const EmploymentAzyk = require('../models/employmentAzyk');

const query = `
    financeReport(organization: ID!, track: Int, forwarder: ID!, dateDelivery: Date!, excel: Boolean): [[String]]
    summaryInvoice(organization: ID!, track: Int!, forwarder: ID!, dateDelivery: Date!, excel: Boolean): [[String]]
`;

const resolvers = {
    financeReport: async(parent, {organization, forwarder, dateDelivery, track, excel}, {user}) =>  {
        if(['суперорганизация', 'организация', 'admin', 'менеджер'].includes(user.role)) {
            //dateDelivery
            dateDelivery.setHours(dayStartDefault, 0, 0, 0)
            // eslint-disable-next-line no-undef
            const forwarderClients = await  DistrictAzyk.find({forwarder}).distinct('client');
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
                }).select('_id client allPrice address track info discount returnedPrice paymentMethod inv').lean(),
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
            let sortedInvoices = {}
            for(const invoice of invoices) {
                invoice.returned = returnedByClient[invoice.client]
                if(!sortedInvoices[invoice.client]) sortedInvoices[invoice.client] = []
                sortedInvoices[invoice.client].push(invoice)
            }
            sortedInvoices = Object.values(sortedInvoices).flat().map(invoice => [
                getClientTitle({address: [invoice.address]}), invoice.allPrice, invoice.discount||'', invoice.allPrice - invoice.returnedPrice,
                invoice.paymentMethod, invoice.returned, invoice.inv===0?'нет':'да', `Рейс: ${invoice.track}\n${invoice.info}`
            ])
            const name = `Отчет по деньгам ${pdDDMMYYYY(dateDelivery)}`
            return excel?await getExcelSheet({worksheetsData: [{
                    columnsWidth: {1: 5, 2: 30, 9: 25}, name,
                    rows: [
                        //headers
                        [`Отчет по деньгам ${pdDDMMYYYY(dateDelivery)}`], [`Экспедитор: ${(await EmploymentAzyk.findById(forwarder)).name}`],
                        //columnsTitle
                        [{value: '№', bold: true}, {value: 'Адрес', bold: true}, {value: 'Отгружено', bold: true}, {value: 'Скидки', bold: true}, {value: 'К оплате', bold: true}, {value: 'Тип оплаты', bold: true}, {value: 'Возврат', bold: true}, {value: 'СФ', bold: true}, {value: 'Комментарий', bold: true}],
                        //rows
                        ...sortedInvoices.map((invoice, idx) => [idx+1, ...invoice]),
                        //footers
                        [{value: 'Итого:', horizontalAlignment: horizontalAlignments.right}, checkFloat(sum(sortedInvoices.map(invoice => checkFloat(invoice[1])))), checkFloat(sum(sortedInvoices.map(invoice => checkFloat(invoice[2])))), checkFloat(sum(sortedInvoices.map(invoice => checkFloat(invoice[3])))), '', checkFloat(sum(sortedInvoices.map(invoice => checkFloat(invoice[5]))))],
                        [],
                        [{value: 'Сдал:', horizontalAlignment: horizontalAlignments.right}, '__________', '', 'Получил:', '__________', '', 'Проверил:', '__________']
                    ]
                }], name}):sortedInvoices
        }
    },
    summaryInvoice: async(parent, {organization, forwarder, dateDelivery, track, excel}, {user}) =>  {
        if(['суперорганизация', 'организация', 'client', 'admin', 'менеджер', 'агент', 'экспедитор', 'суперагент', 'суперэкспедитор'].includes(user.role)) {
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
            if(excel) {
                const forwarderName = (await EmploymentAzyk.findById(forwarder).select('name').lean()).name
                dateDelivery = pdDDMMYYYY(dateDelivery)
                const nameExcel = `Сводная накладная ${dateDelivery}`
                const rows = []
                let rowIdx = 0
                let countAll = 0, packageAll = 0, priceAll = 0, tonnageAll = 0
                for(let idx = 0; idx < summaryInvoice.length; idx += 1) {
                    const invoice = summaryInvoice[idx]
                    const prevInvoice = summaryInvoice[idx - 1]
                    const nextInvoice = summaryInvoice[idx + 1]
                    const isFirst = isEmpty(prevInvoice)||prevInvoice[0]!==invoice[0]
                    const isLast = isEmpty(nextInvoice)||nextInvoice[0]!==invoice[0]

                    if(isFirst) {
                        countAll = 0; packageAll = 0; priceAll = 0; tonnageAll = 0; rowIdx = 0
                        rows.push([`Общий отпуск от ${dateDelivery}`])
                        rows.push([`Склад: ${invoice[0]}`])
                        rows.push([`Экспедитор: ${forwarderName}`])
                        rows.push([`Рейс №${track}`])
                        rows.push([{value: '№', bold: true}, {value: 'Товар', bold: true}, {value: 'Кол-во', bold: true}, {value: 'Уп-ок', bold: true}, {value: 'Сумма', bold: true}, {value: 'Тоннаж', bold: true}])
                    }
                    rowIdx += 1
                    rows.push([rowIdx, {value: invoice[1], wrap: true}, invoice[2], invoice[3], invoice[4], invoice[5]])
                    countAll += checkFloat(invoice[2]); packageAll += checkFloat(invoice[3]); priceAll += checkFloat(invoice[4]); tonnageAll += checkFloat(invoice[5])
                    if(isLast) {
                        rows.push(['', {value: 'Итого:', horizontalAlignment: horizontalAlignments.right}, checkFloat(countAll), checkFloat(packageAll), checkFloat(priceAll), checkFloat(tonnageAll)])
                        rows.push([])
                        rows.push(['', {value: 'Отпустил:', horizontalAlignment: horizontalAlignments.right}, '__________', '', {value: 'Получил:', horizontalAlignment: horizontalAlignments.right}, '__________'])
                        rows.push([])
                        rows.push([])
                    }
                }

                return getExcelSheet({worksheetsData: [{
                        name: nameExcel, columnsWidth: {1: 5, 2: 35, },
                        rows
                    }], name: nameExcel})
            }
            else return summaryInvoice
        }
    }
};

module.exports.query = query;
module.exports.resolvers = resolvers;