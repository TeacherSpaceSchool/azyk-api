const InvoiceAzyk = require('../models/invoiceAzyk');
const Integrate1CAzyk = require('../models/integrate1CAzyk');
const ClientAzyk = require('../models/clientAzyk');
const OrganizationAzyk = require('../models/organizationAzyk');
const EmploymentAzyk = require('../models/employmentAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const AgentRouteAzyk = require('../models/agentRouteAzyk');
const ItemAzyk = require('../models/itemAzyk');
const UserAzyk = require('../models/userAzyk');
const {pdDDMMYYYY, checkDate, dayStartDefault} = require('../module/const');
const ExcelJS = require('exceljs');
const randomstring = require('randomstring');
const app = require('../app');
const fs = require('fs');
const path = require('path');
const {urlMain, saveFile, deleteFile, checkFloat, checkInt} = require('../module/const');
const readXlsxFile = require('read-excel-file/node');
const AutoAzyk = require('../models/autoAzyk');
const {parallelPromise, parallelBulkWrite} = require('../module/parallel');

const query = `
    downloadInvoices(organization: ID!, dateStart: Date!, all: Boolean): String
    downloadOrders(filter: String!, organization: ID!, dateStart: Date!): String
    downloadClients(organization: ID!, city: String): String
    downloadEmployments(organization: ID!): String
    downloadDistricts(organization: ID!): String
    downloadAgentRoutes(organization: ID!): String
    downloadAdsOrders(organization: ID!, dateStart: Date!): String
`;

const mutation = `
    uploadClients(document: Upload!, organization: ID!, city: String!): String
    uploadItems(document: Upload!, organization: ID!, city: String!): String
    uploadDistricts(document: Upload!, organization: ID!): String
    uploadAgentRoute(document: Upload!, agentRoute: ID!, ): String
   `;

const resolvers = {
    downloadOrders: async(parent, {filter, organization, dateStart}, {user}) => {
        if(['admin', 'суперорганизация'].includes(user.role)) {
            organization = user.organization?user.organization:organization
            let workbook = new ExcelJS.Workbook();
            dateStart = checkDate(dateStart)
            dateStart.setHours(dayStartDefault, 0, 0, 0)
            let dateEnd = new Date(dateStart)
            dateEnd.setDate(dateEnd.getDate() + 1)
            let data = await InvoiceAzyk.find(
                {
                    ...filter==='Дата доставки'?{dateDelivery: {$gte: dateStart, $lt: dateEnd}}:{createdAt: {$gte: dateStart, $lt: dateEnd}},
                    del: {$ne: 'deleted'},
                    taken: true,
                    organization: organization
               }
            )
                .populate({
                    path: 'orders',
                    populate : [
                        {
                            path : 'item',
                       }
                    ]
               })
                .populate({
                    path : 'client',
                    select: 'name _id phone'
               })
                .populate({
                    path : 'agent',
                    select: 'name _id'
               })
                .populate({
                    path : 'adss'
               }).lean()
            let worksheet;
            worksheet = await workbook.addWorksheet('Заказы');
            worksheet.getColumn(1).width = 30;
            worksheet.getColumn(2).width = 20;
            worksheet.getColumn(3).width = 15;
            worksheet.getColumn(4).width = 15;
            worksheet.getColumn(5).width = 15;
            let row = 1;
            for(let i = 0; i<data.length;i++) {
                if(i!==0) {
                    row += 2;
               }
                worksheet.getCell(`A${row}`).font = {bold: true, size: 14};
                worksheet.getCell(`A${row}`).value = `Заказ${i+1}`;
                if(data[i].agent) {
                    row += 1;
                    worksheet.getCell(`A${row}`).font = {bold: true};
                    worksheet.getCell(`A${row}`).value = 'Агент:';
                    worksheet.getCell(`B${row}`).value = data[i].agent.name
               }
                row += 1;
                worksheet.getCell(`A${row}`).font = {bold: true};
                worksheet.getCell(`A${row}`).value = 'Дата доставки:';
                worksheet.getCell(`B${row}`).value = pdDDMMYYYY(data[i].dateDelivery)
                row+=1;
                worksheet.getCell(`A${row}`).font = {bold: true};
                worksheet.getCell(`A${row}`).value = 'Клиент:';
                worksheet.getCell(`B${row}`).value = data[i].client.name;
                row+=1;
                worksheet.getCell(`A${row}`).font = {bold: true};
                worksheet.getCell(`A${row}`).value = 'Адрес:';
                worksheet.getCell(`B${row}`).value = `${data[i].address[2] ? `${data[i].address[2]}, ` : ''}${data[i].address[0]}`;
                for(let i1=0; i1<data[i].client.phone.length; i1++) {
                    row+=1;
                    if(!i1) {
                        worksheet.getCell(`A${row}`).font = {bold: true};
                        worksheet.getCell(`A${row}`).value = 'Телефон:';
                   }
                    worksheet.getCell(`B${row}`).value = data[i].client.phone[i1];
               }
                if(data[i].adss) {
                    for(let i1=0; i1<data[i].adss.length; i1++) {
                        row+=1;
                        if(!i1) {
                            worksheet.getCell(`A${row}`).font = {bold: true};
                            worksheet.getCell(`A${row}`).value = 'Акция:';
                       }
                        worksheet.getCell(`B${row}`).value = data[i].adss[i1].title;
                   }
               }
                row+=1;
                worksheet.getCell(`A${row}`).font = {bold: true};
                worksheet.getCell(`A${row}`).value = 'Сумма:';
                worksheet.getCell(`B${row}`).value = `${data[i].allPrice} сом`;
                row+=1;
                worksheet.getCell(`A${row}`).font = {bold: true};
                worksheet.getCell(`A${row}`).value = 'Товары:';
                worksheet.getCell(`B${row}`).font = {bold: true};
                worksheet.getCell(`B${row}`).value = 'Количество:';
                worksheet.getCell(`C${row}`).font = {bold: true};
                worksheet.getCell(`C${row}`).value = 'Упаковок:';
                worksheet.getCell(`D${row}`).font = {bold: true};
                worksheet.getCell(`D${row}`).value = 'Сумма:';
                for(let i1=0; i1<data[i].orders.length; i1++) {
                    row += 1;
                    worksheet.addRow([
                        data[i].orders[i1].item.name,
                        `${data[i].orders[i1].count} ${data[i].orders[i1].item.unit&&data[i].orders[i1].item.unit?data[i].orders[i1].item.unit:'шт'}`,
                        `${checkFloat(data[i].orders[i1].count/(data[i].orders[i1].packaging?data[i].orders[i1].packaging:1))} уп`,
                        `${data[i].orders[i1].allPrice} сом`
                    ]);
               }
           }
            let xlsxname = `${randomstring.generate(20)}.xlsx`;
            let xlsxdir = path.join(app.dirname, 'public', 'xlsx');
            if (!await fs.existsSync(xlsxdir)) {
                await fs.mkdirSync(xlsxdir);
           }
            let xlsxpath = path.join(app.dirname, 'public', 'xlsx', xlsxname);
            await workbook.xlsx.writeFile(xlsxpath);
            return urlMain + '/xlsx/' + xlsxname
       }
   },
    downloadInvoices: async(parent, {organization, dateStart}, {user}) => {
        if(['admin', 'суперорганизация'].includes(user.role)) {
            organization = user.organization?user.organization:organization
            let workbook = new ExcelJS.Workbook();
            let dateEnd
            dateStart = checkDate(dateStart)
            dateStart.setHours(dayStartDefault, 0, 0, 0)
            dateEnd = new Date(dateStart)
            dateEnd.setDate(dateEnd.getDate() + 1)
            // eslint-disable-next-line no-undef
            const [invoices, organizationData] = await Promise.all([
                InvoiceAzyk.find(
                    {
                        createdAt: {$gte: dateStart, $lt: dateEnd},
                        del: {$ne: 'deleted'},
                        taken: true,
                        organization
                   }
                )
                    .populate({
                        path: 'orders',
                        populate : [
                            {
                                path : 'item',
                           }
                        ]
                   })
                    .populate({
                        path : 'client'
                   })
                    .populate({
                        path : 'forwarder'
                   })
                    .populate({
                        path : 'agent'
                   })
                    .populate({
                        path : 'adss'
                   })
                    .lean(),
                OrganizationAzyk.findById(organization).lean()
            ])
            organization = organizationData
            let worksheet;
            let auto
            let itemOrders = {}
            let allCount = 0
            let allPrice = 0
            let allTonnage = 0
            for(const invoice of invoices) {
                for(const order of invoice.orders) {
                    if(!itemOrders[order.item._id])
                        itemOrders[order.item._id] = {
                            name: order.item.name,
                            count: 0,
                            allPrice: 0,
                            packaging: order.item.packaging,
                            allTonnage: 0,
                       }
                    itemOrders[order.item._id].count += order.count
                    itemOrders[order.item._id].allPrice += order.allPrice
                    itemOrders[order.item._id].allTonnage += order.allTonnage
                    allCount += order.count
                    allPrice += order.allPrice
                    allTonnage += order.allTonnage
               }
           }
            worksheet = await workbook.addWorksheet('Лист загрузки');
            let row = 1;
            worksheet.getColumn(1).width = 25;
            worksheet.getColumn(2).width = 15;
            worksheet.getColumn(3).width = 15;
            worksheet.getColumn(4).width = 15;
            worksheet.getColumn(5).width = 15;
            worksheet.getCell(`A${row}`).font = {bold: true};
            worksheet.getCell(`A${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
            worksheet.getCell(`A${row}`).value = 'Товар:';
            worksheet.getCell(`B${row}`).font = {bold: true};
            worksheet.getCell(`B${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
            worksheet.getCell(`B${row}`).value = 'Количество:';
            worksheet.getCell(`C${row}`).font = {bold: true};
            worksheet.getCell(`C${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
            worksheet.getCell(`C${row}`).value = 'Упаковок:';
            worksheet.getCell(`D${row}`).font = {bold: true};
            worksheet.getCell(`D${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
            worksheet.getCell(`D${row}`).value = 'Сумма:';
            if(allTonnage) {
                worksheet.getCell(`E${row}`).font = {bold: true};
                worksheet.getCell(`E${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                worksheet.getCell(`E${row}`).value = 'Тоннаж:';
           }
            const itemKeys = Object.keys(itemOrders)
            for(const itemKey of itemKeys) {
                const itemOrder = itemOrders[itemKey]
                row += 1;
                worksheet.getCell(`A${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                worksheet.getCell(`A${row}`).alignment = {wrapText: true};
                worksheet.getCell(`A${row}`).value = itemOrder.name;
                worksheet.getCell(`B${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                worksheet.getCell(`B${row}`).value = `${itemOrder.count} шт`;
                worksheet.getCell(`C${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                worksheet.getCell(`C${row}`).value = `${checkFloat(itemOrder.count/(itemOrder.packaging||1))} уп`;
                worksheet.getCell(`D${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                worksheet.getCell(`D${row}`).value = `${itemOrder.allPrice} сом`;
                if(allTonnage) {
                    worksheet.getCell(`E${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                    worksheet.getCell(`E${row}`).value = `${itemOrder.allTonnage} кг`;
               }
           }
            row += 1;
            worksheet.getCell(`A${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
            worksheet.getCell(`A${row}`).alignment = {wrapText: true};
            worksheet.getCell(`A${row}`).font = {bold: true};
            worksheet.getCell(`A${row}`).value = 'Итого';
            worksheet.getCell(`B${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
            worksheet.getCell(`B${row}`).value = `${allCount} шт`;
            worksheet.getCell(`C${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
            worksheet.getCell(`C${row}`).value = '';
            worksheet.getCell(`D${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
            worksheet.getCell(`D${row}`).value = `${allPrice} сом`;
            if(allTonnage) {
                worksheet.getCell(`E${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                worksheet.getCell(`E${row}`).value = `${allTonnage} кг`;
           }


            for(const invoice of invoices) {
                worksheet = await workbook.addWorksheet(`Накладная ${invoice.number}`);
                worksheet.getColumn(1).width = 25;
                worksheet.getColumn(2).width = 15;
                worksheet.getColumn(3).width = 15;
                worksheet.getColumn(4).width = 15;
                worksheet.getColumn(5).width = 15;
                row = 1;
                let date = invoice.createdAt;
                date = date.setDate(date.getDate() + 1)
                worksheet.getCell(`A${row}`).font = {bold: true, size: 14};
                worksheet.getCell(`A${row}`).value = `Накладная №${invoice.number} от ${pdDDMMYYYY(date)}`;
                row+=1;
                worksheet.getCell(`A${row}`).font = {bold: true};
                worksheet.getCell(`A${row}`).value = 'Продавец:';
                worksheet.getCell(`B${row}`).value = organization.name;
                if(organization.address&&organization.address.length) {
                    row += 1;
                    worksheet.getCell(`A${row}`).font = {bold: true};
                    worksheet.getCell(`A${row}`).value = 'Адрес продавца:';
                    worksheet.getCell(`B${row}`).value = `${organization.address}`;
               }
                if(organization.phone&&organization.phone.length) {
                    row+=1;
                    worksheet.getCell(`A${row}`).font = {bold: true};
                    worksheet.getCell(`A${row}`).value = 'Телефон продавца:';
                    worksheet.getCell(`B${row}`).value = organization.phone;
               }
                row+=1;
                worksheet.getCell(`A${row}`).font = {bold: true};
                worksheet.getCell(`A${row}`).value = 'Получатель:';
                worksheet.getCell(`B${row}`).value = invoice.client.name;
                row+=1;
                worksheet.getCell(`A${row}`).font = {bold: true};
                worksheet.getCell(`A${row}`).value = 'Адрес получателя:';
                worksheet.getCell(`B${row}`).value = `${invoice.address[2] ? `${invoice.address[2]}, ` : ''}${invoice.address[0]}`;
                for(let i1=0; i1<invoice.client.phone.length; i1++) {
                    row+=1;
                    if(!i1) {
                        worksheet.getCell(`A${row}`).font = {bold: true};
                        worksheet.getCell(`A${row}`).value = 'Телефон получателя:';
                   }
                    worksheet.getCell(`B${row}`).value = invoice.client.phone[i1];
               }
                /*if(forwarder) {
                    let district = await DistrictAzyk.findOne({client: invoice.client._id, organization: forwarder!=='super'?forwarder:null}).populate('forwarder').lean()
                    invoice.forwarder = district&&district.forwarder?district.forwarder:{}
               }*/
                if(invoice.forwarder) {
                    row+=1;
                    worksheet.getCell(`A${row}`).font = {bold: true};
                    worksheet.getCell(`A${row}`).value = 'Экспедитор:';
                    worksheet.getCell(`B${row}`).value = invoice.forwarder.name;
                    if(invoice.forwarder.phone&&invoice.forwarder.phone.length) {
                        row+=1;
                        worksheet.getCell(`A${row}`).font = {bold: true};
                        worksheet.getCell(`A${row}`).value = 'Тел:';
                        worksheet.getCell(`B${row}`).value = invoice.forwarder.phone
                   }
                    auto = await AutoAzyk.findOne({employment: invoice.forwarder._id})
                    row+=1;
                    worksheet.getCell(`A${row}`).font = {bold: true};
                    worksheet.getCell(`A${row}`).value = '№ рейса:';
                    worksheet.getCell(`B${row}`).value = invoice.track;
                    if(auto&&auto.number) {
                        worksheet.getCell(`C${row}`).font = {bold: true};
                        worksheet.getCell(`C${row}`).value = '№ авто:';
                        worksheet.getCell(`D${row}`).value = auto.number;
                   }
               }
                if(invoice.adss) {
                    row+=1;
                    for(let i1=0; i1<invoice.adss.length; i1++) {
                        row+=1;
                        if(!i1) {
                            worksheet.getCell(`A${row}`).font = {bold: true};
                            worksheet.getCell(`A${row}`).value = 'Акция:';
                       }
                        worksheet.getCell(`B${row}`).value = invoice.adss[i1].title;
                   }
                    row+=1;
               }
                row+=1;
                worksheet.getCell(`A${row}`).font = {bold: true};
                worksheet.getCell(`A${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                worksheet.getCell(`A${row}`).value = 'Товар:';
                worksheet.getCell(`B${row}`).font = {bold: true};
                worksheet.getCell(`B${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                worksheet.getCell(`B${row}`).value = 'Цена:';
                worksheet.getCell(`C${row}`).font = {bold: true};
                worksheet.getCell(`C${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                worksheet.getCell(`C${row}`).value = 'Количество:';
                worksheet.getCell(`D${row}`).font = {bold: true};
                worksheet.getCell(`D${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                worksheet.getCell(`D${row}`).value = 'Упаковок:';
                worksheet.getCell(`E${row}`).font = {bold: true};
                worksheet.getCell(`E${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                worksheet.getCell(`E${row}`).value = 'Сумма:';
                for(const order of invoice.orders) {
                    row += 1;
                    worksheet.getCell(`A${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                    worksheet.getCell(`A${row}`).alignment = {wrapText: true};
                    worksheet.getCell(`A${row}`).value = order.item.name;
                    worksheet.getCell(`B${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                    worksheet.getCell(`B${row}`).value = `${order.item.price} сом`;
                    worksheet.getCell(`C${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                    worksheet.getCell(`C${row}`).value = `${order.count} шт`;
                    worksheet.getCell(`D${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                    worksheet.getCell(`D${row}`).value = `${checkFloat(order.count/(order.packaging?order.packaging:1))} уп`;
                    worksheet.getCell(`E${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                    worksheet.getCell(`E${row}`).value = `${order.allPrice} сом`;
               }

                row+=1;
                worksheet.getCell(`C${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                worksheet.getCell(`C${row}`).font = {bold: true};
                worksheet.getCell(`C${row}`).value = 'Сумма:';
                worksheet.getCell(`D${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                worksheet.getCell(`D${row}`).value = `${invoice.allPrice} сом`;
                row+=1;
                worksheet.getCell(`A${row}`).font = {bold: true};
                worksheet.getCell(`A${row}`).value = 'Отпустил:';
                worksheet.getCell(`B${row}`).border = {bottom: {style:'thin'}};
                worksheet.getCell(`C${row}`).border = {bottom: {style:'thin'}};
                row+=1;
                worksheet.getCell(`A${row}`).font = {bold: true};
                worksheet.getCell(`A${row}`).value = 'Получил:';
                worksheet.getCell(`B${row}`).border = {bottom: {style:'thin'}};
                worksheet.getCell(`C${row}`).border = {bottom: {style:'thin'}};
           }
            let xlsxname = `${randomstring.generate(20)}.xlsx`;
            let xlsxdir = path.join(app.dirname, 'public', 'xlsx');
            if (!await fs.existsSync(xlsxdir)) {
                await fs.mkdirSync(xlsxdir);
           }
            let xlsxpath = path.join(app.dirname, 'public', 'xlsx', xlsxname);
            await workbook.xlsx.writeFile(xlsxpath);
            return urlMain + '/xlsx/' + xlsxname
       }
   },
    downloadAdsOrders: async(parent, {organization, dateStart}, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)) {
            organization = user.organization?user.organization:organization
            let workbook = new ExcelJS.Workbook();
            dateStart = new Date(dateStart)
            dateStart.setHours(dayStartDefault, 0, 0, 0)
            if(user.organization)
                organization = user.organization
            // eslint-disable-next-line no-undef
            const [districts, invoices] = await Promise.all([
                DistrictAzyk.find({organization}).lean(),
                InvoiceAzyk.find({
                    dateDelivery: dateStart,
                    del: {$ne: 'deleted'},
                    taken: true,
                    organization,
                    adss: {$ne: []}
               })
                    .populate({path: 'adss', populate : [{path : 'item'}]})
                    .populate({path : 'client'})
                    .lean()
            ])
            const districtByClient = {}
            for(const district of districts) {
                for(const client of district.client) {
                    districtByClient[client._id] = district._id
               }
           }
            const invoicesByDistrict = {}
            for(const invoice of invoices) {
                const districtKey = districtByClient[invoice.client._id];
                if(!invoicesByDistrict[districtKey]) invoicesByDistrict[districtKey] = []
                invoicesByDistrict[districtKey].push(invoice)
           }
            districts.push({
                name: 'Не указан'
           })
            for(const district of districts) {
                const districtKey = district._id;
                const invoices = await invoicesByDistrict[districtKey]
                if (invoices&&invoices.length) {
                    let worksheet;
                    worksheet = await workbook.addWorksheet(`Район ${district.name}`);
                    worksheet.getColumn(1).width = 30;
                    worksheet.getColumn(2).width = 20;
                    worksheet.getColumn(3).width = 15;
                    worksheet.getColumn(4).width = 15;
                    worksheet.getColumn(5).width = 15;
                    let row = 1;
                    for(const invoice of invoices) {
                        row += 2;
                        worksheet.getCell(`A${row}`).font = {bold: true, size: 14};
                        worksheet.getCell(`A${row}`).value = 'Акция';
                        row += 1;
                        worksheet.getCell(`A${row}`).font = {bold: true};
                        worksheet.getCell(`A${row}`).value = 'Клиент:';
                        worksheet.getCell(`B${row}`).value = invoice.client.name;
                        row+=1;
                        worksheet.getCell(`A${row}`).font = {bold: true};
                        worksheet.getCell(`A${row}`).value = 'Адрес:';
                        worksheet.getCell(`B${row}`).value = `${invoice.address[2] ? `${invoice.address[2]}, ` : ''}${invoice.address[0]}`;
                        for(let i1=0; i1<invoice.client.phone.length; i1++) {
                            row+=1;
                            if(!i1) {
                                worksheet.getCell(`A${row}`).font = {bold: true};
                                worksheet.getCell(`A${row}`).value = 'Телефон:';
                           }
                            worksheet.getCell(`B${row}`).value = invoice.client.phone[i1];
                       }
                        row+=1;
                        for(let i1=0; i1<invoice.adss.length; i1++) {
                            worksheet.getCell(`A${row}`).font = {bold: true};
                            worksheet.getCell(`A${row}`).value = 'Акция:';
                            worksheet.getCell(`B${row}`).value = `${invoice.adss[i1].title}`;
                            row+=1;
                            if(invoice.adss[i1].item) {
                                worksheet.getCell(`A${row}`).font = {bold: true};
                                worksheet.getCell(`A${row}`).value = 'Товар:';
                                worksheet.getCell(`B${row}`).value = `${invoice.adss[i1].item.name}`;
                                row+=1;
                                worksheet.getCell(`A${row}`).font = {bold: true};
                                worksheet.getCell(`A${row}`).value = 'Количество:';
                                worksheet.getCell(`B${row}`).value = `${invoice.adss[i1].count}`;
                                row+=1;
                                worksheet.getCell(`A${row}`).font = {bold: true};
                                worksheet.getCell(`A${row}`).value = 'Упаковок:';
                                worksheet.getCell(`B${row}`).value = `${invoice.adss[i1].count/(invoice.adss[i1].item.packaging ? invoice.adss[i1].item.packaging : 1)}`;
                                row+=1;
                           }
                       }
                   }
               }

           }

            let xlsxname = `${randomstring.generate(20)}.xlsx`;
            let xlsxdir = path.join(app.dirname, 'public', 'xlsx');
            if (!await fs.existsSync(xlsxdir)) {
                await fs.mkdirSync(xlsxdir);
           }
            let xlsxpath = path.join(app.dirname, 'public', 'xlsx', xlsxname);
            await workbook.xlsx.writeFile(xlsxpath);
            return urlMain + '/xlsx/' + xlsxname
       }
   },
    downloadClients: async(parent, {organization, city}, {user}) => {
        if(['admin', 'суперорганизация'].includes(user.role)) {
            organization = user.organization?user.organization:organization
            let cities
            if(organization!=='super')
                cities = (await OrganizationAzyk.findById(organization).select('cities').lean()).cities
            let workbook = new ExcelJS.Workbook();
            let clients = await ClientAzyk.find(
                {
                    ...city?{city}:cities?{city: {$in: cities}}:{},
                    ...{del: {$ne: 'deleted'}}
               }
            ).lean()
            clients = clients.filter(client => {
                return(client.name.length&&client.address[0]&&!(client.name.toLowerCase()).includes('агент')&&!(client.name.toLowerCase()).includes('agent'))
           })
            let integrates = await Integrate1CAzyk.find({
                organization: organization==='super'?null:organization,
                client: {$in: clients.map(client => client._id)}
           }).select('client guid').lean()
            const guidByClient = {}
            for(const integrate of integrates) {
                guidByClient[integrate.client] = integrate.guid
           }
            let worksheet;
            worksheet = await workbook.addWorksheet('Клиенты');
            worksheet.getColumn(1).width = 30;
            worksheet.getCell('A1').font = {bold: true, size: 14};
            worksheet.getCell('A1').value = 'ID';
            worksheet.getColumn(2).width = 30;
            worksheet.getCell('B1').font = {bold: true, size: 14};
            worksheet.getCell('B1').value = 'GUID';
            worksheet.getColumn(3).width = 30;
            worksheet.getCell('C1').font = {bold: true, size: 14};
            worksheet.getCell('C1').value = 'Магазин';
            worksheet.getColumn(4).width = 30;
            worksheet.getCell('D1').font = {bold: true, size: 14};
            worksheet.getCell('D1').value = 'Адрес';
            worksheet.getColumn(5).width = 30;
            worksheet.getCell('E1').font = {bold: true, size: 14};
            worksheet.getCell('E1').value = 'Телефон';
            for(const client of clients) {
                let GUID = guidByClient[client._id]||''
                worksheet.addRow([
                    client._id,
                    GUID,
                    client.address[0][2],
                    client.address[0][0],
                    client.phone.reduce((accumulator, currentValue, index) => accumulator + `${index!==0?', ':''}${currentValue}`, '')
                ]);
           }

            let xlsxname = `${randomstring.generate(20)}.xlsx`;
            let xlsxdir = path.join(app.dirname, 'public', 'xlsx');
            if (!await fs.existsSync(xlsxdir)) {
                await fs.mkdirSync(xlsxdir);
           }
            let xlsxpath = path.join(app.dirname, 'public', 'xlsx', xlsxname);
            await workbook.xlsx.writeFile(xlsxpath);
            return urlMain + '/xlsx/' + xlsxname
       }
   },
    downloadEmployments: async(parent, {organization}, {user}) => {
        if(['admin', 'суперорганизация'].includes(user.role)) {
            organization = user.organization?user.organization:organization
            let workbook = new ExcelJS.Workbook();
            let employments = await EmploymentAzyk.find(
                {
                    ...(organization==='super'?{organization: null}:{organization}),
                    ...{del: {$ne: 'deleted'}}
               }
            ).populate('user').lean()
            let integrates = await Integrate1CAzyk.find({
                organization: organization==='super'?null:organization,
                $or: [
                    {agent: {$in: employments.map(employment => employment._id)}},
                    {forwarder: {$in: employments.map(employment => employment._id)}}
                ]
           }).select('agent forwarder guid').lean()
            const guidByEmployment = {}
            for(const integrate of integrates) {
                guidByEmployment[(integrate.agent||integrate.forwarder)] = integrate.guid
           }
            let worksheet;
            worksheet = await workbook.addWorksheet('Сотрудники');
            worksheet.getColumn(1).width = 30;
            worksheet.getCell('A1').font = {bold: true, size: 14};
            worksheet.getCell('A1').value = 'ID';
            worksheet.getColumn(2).width = 30;
            worksheet.getCell('B1').font = {bold: true, size: 14};
            worksheet.getCell('B1').value = 'GUID';
            worksheet.getColumn(3).width = 30;
            worksheet.getCell('C1').font = {bold: true, size: 14};
            worksheet.getCell('C1').value = 'Имя';
            worksheet.getColumn(4).width = 30;
            worksheet.getCell('C1').font = {bold: true, size: 14};
            worksheet.getCell('C1').value = 'Роль';
            worksheet.getColumn(4).width = 30;
            worksheet.getCell('E1').font = {bold: true, size: 14};
            worksheet.getCell('E1').value = 'Телефон';
            for(const employment of employments) {
                let GUID = guidByEmployment[employment._id]||''
                worksheet.addRow([
                    employment._id,
                    GUID,
                    employment.name,
                    employment.user.role,
                    employment.phone.reduce((accumulator, currentValue, index) => accumulator + `${index!==0?', ':''}${currentValue}`, '')
                ]);
           }

            let xlsxname = `${randomstring.generate(20)}.xlsx`;
            let xlsxdir = path.join(app.dirname, 'public', 'xlsx');
            if (!await fs.existsSync(xlsxdir)) {
                await fs.mkdirSync(xlsxdir);
           }
            let xlsxpath = path.join(app.dirname, 'public', 'xlsx', xlsxname);
            await workbook.xlsx.writeFile(xlsxpath);
            return urlMain + '/xlsx/' + xlsxname
       }
   },
    downloadDistricts: async(parent, {organization}, {user}) => {
        if(['admin', 'суперорганизация'].includes(user.role)) {
            organization = user.organization?user.organization:organization
            let workbook = new ExcelJS.Workbook();
            let districts = await DistrictAzyk.find({organization: organization==='super'?null:organization}).populate('client').lean()
            let worksheet = await workbook.addWorksheet('Районы');
            worksheet.getColumn(1).width = 30;
            worksheet.getCell('A1').font = {bold: true, size: 14};
            worksheet.getCell('A1').value = 'Клиент';
            worksheet.getColumn(2).width = 30;
            worksheet.getCell('B1').font = {bold: true, size: 14};
            worksheet.getCell('B1').value = 'Агент';
            for(const district of districts) {
                for(const client of district.client) {
                    worksheet.addRow([
                        client._id.toString(),
                        district.agent.toString()
                    ]);
               }
           }
            let xlsxname = `${randomstring.generate(20)}.xlsx`;
            let xlsxdir = path.join(app.dirname, 'public', 'xlsx');
            if (!await fs.existsSync(xlsxdir))
                await fs.mkdirSync(xlsxdir);
            let xlsxpath = path.join(app.dirname, 'public', 'xlsx', xlsxname);
            await workbook.xlsx.writeFile(xlsxpath);
            return urlMain + '/xlsx/' + xlsxname
       }
   },
    downloadAgentRoutes: async(parent, {organization}, {user}) => {
        if(['admin', 'суперорганизация'].includes(user.role)) {
            organization = user.organization?user.organization:organization
            let workbook = new ExcelJS.Workbook();
            let agentRoutes = await AgentRouteAzyk
                .find({organization: organization==='super'?null:organization})
                .populate({path: 'district', select: 'name'})
                .populate({path: 'clients', select: '_id address'})
                .lean()
            let integrates = await Integrate1CAzyk.find({
                organization: organization==='super'?null:organization,
                client: {$in: ((agentRoutes.map(agentRoute => agentRoute.clients)).flat(2)).map(client => client._id)}
           }).select('client guid').lean()
            const guidByClient = {}
            for(const integrate of integrates) {
                guidByClient[integrate.client._id] = integrate.guid
           }
            let worksheet;
            for(const agentRoute of agentRoutes) {
                worksheet = await workbook.addWorksheet(agentRoute.district.name);
                const fields = [
                    [{name: 'A', idx: 1}, {name: 'B', idx: 2}, {name: 'C', idx: 3}],
                    [{name: 'E', idx: 5}, {name: 'F', idx: 6}, {name: 'G', idx: 7}],
                    [{name: 'I', idx: 9}, {name: 'J', idx: 10}, {name: 'K', idx: 11}],
                    [{name: 'M', idx: 13}, {name: 'N', idx: 14}, {name: 'O', idx: 15}],
                    [{name: 'Q', idx: 17}, {name: 'R', idx: 18}, {name: 'S', idx: 19}],
                    [{name: 'U', idx: 21}, {name: 'V', idx: 22}, {name: 'W', idx: 23}],
                    [{name: 'Y', idx: 25}, {name: 'Z', idx: 26}, {name: 'AA', idx: 27}]
                ];
                const headers = ['ID', 'GUID', 'Магазин'];
                for(let i = 0; i < 7; i++) {
                    for(let i1 = 0; i1 < 3; i1++) {
                        const {name, idx} = fields[i][i1]
                        worksheet.getCell(`${name}1`).font = {bold: true, size: 14};
                        worksheet.getCell(`${name}1`).value = headers[i1];
                        worksheet.getColumn(idx).width = 30;
                   }
               }
                for(let i = 0; i < 7; i++) {
                    for(let i1 = 0; i1 < agentRoute.clients[i].length; i1++) {
                        worksheet.getCell(`${fields[i][0].name}${i1 + 2}`).value = agentRoute.clients[i][i1]._id;
                        worksheet.getCell(`${fields[i][1].name}${i1 + 2}`).value = guidByClient[agentRoute.clients[i][i1]._id]||'';
                        worksheet.getCell(`${fields[i][2].name}${i1 + 2}`).value = `${agentRoute.clients[i][i1].address[2] ? `${agentRoute.clients[i][i1].address[2]}, ` : ''}${agentRoute.clients[i][i1].address[0]}`;
                   }
               }
           }

            let xlsxname = `${randomstring.generate(20)}.xlsx`;
            let xlsxdir = path.join(app.dirname, 'public', 'xlsx');
            if (!await fs.existsSync(xlsxdir)) {
                await fs.mkdirSync(xlsxdir);
           }
            let xlsxpath = path.join(app.dirname, 'public', 'xlsx', xlsxname);
            await workbook.xlsx.writeFile(xlsxpath);
            return urlMain + '/xlsx/' + xlsxname
       }
   },
};

const resolversMutation = {
    uploadItems: async(parent, {document, organization}, {user}) => {
        if (user.role === 'admin') {
            organization = await OrganizationAzyk.findByID(organization).select('_id cities').lean()
            let {stream, filename} = await document;
            let xlsxpath = path.join(app.dirname, 'public', await saveFile(stream, filename));
            let rows = await readXlsxFile(xlsxpath)
            const integrates = await Integrate1CAzyk.find({organization, guid: {$in: rows.map(row => row[0])}, item: {$ne: null}}).select('guid item').lean()
            const itemByGuid = {}
            for(const integrate of integrates) itemByGuid[integrate.guid] = integrate.item
            // подготовим массив операций
            const itemBulkOperations = [];
            const integrateBulkOperations = [];
            const itemsForCreate = []
            //обработанные элементы
            const processedElements = {}
            //перебор
            for(const row of rows) {
                if(!processedElements[row[0]]) {
                    processedElements[row[0]] = true
                    const updateFields = {
                        guid: row[0],
                        name: row[1],
                        price: checkFloat(row[2]),
                        packaging: checkInt(row[3]),
                        weight: checkFloat(row[4]),
                        priotiry: checkInt(row[5]),
                        apiece: row[6] == '1',
                   }
                    const item = itemByGuid[row[0]]
                    if (!item) {
                        itemsForCreate.push({
                            image: process.env.URL.trim() + '/static/add.png',
                            info: '',
                            organization: organization._id,
                            hit: false,
                            categorys: ['A', 'B', 'C', 'D', 'Horeca'],
                            latest: false,
                            status: 'active',
                            unit: 'шт',
                            city: organization.cities[0],
                            ...updateFields
                       })
                   }
                    else {
                        if (Object.keys(updateFields).length)
                            itemBulkOperations.push({updateOne: {filter: {_id: item, organization}, update: {$set: updateFields}}});
                   }
               }
           }
            //создание товаров
            await parallelPromise(itemsForCreate, async (itemForCreate) => {
                const item = await ItemAzyk.create(itemForCreate);
                integrateBulkOperations.push({insertOne: {document: {item: item._id, organization, guid: itemForCreate.guid}}});
           })
            // если есть обновления — выполним bulkWrite
            if (itemBulkOperations.length) await parallelBulkWrite(ItemAzyk, itemBulkOperations);
            if (integrateBulkOperations.length) await parallelBulkWrite(Integrate1CAzyk, integrateBulkOperations);
            await deleteFile(filename)
            return  'OK'
       }
   },
    uploadClients: async(parent, {document, organization}, {user}) => {
        if (user.role === 'admin') {
            let {stream, filename} = await document;
            let xlsxpath = path.join(app.dirname, 'public', await saveFile(stream, filename));
            let rows = await readXlsxFile(xlsxpath)
            organization = await OrganizationAzyk.findByID(organization).select('_id cities').lean()
            //получаем интеграции
            const integrates = await Integrate1CAzyk.find({
                organization: organization._id, guid: {$in: rows.map(row => row[0])}, client: {$ne: null}
           }).select('client guid').lean()
            const clientByGuid = {}
            for(const integrate of integrates) clientByGuid[integrate.guid] = integrate.client
            //approximateClients
            const approximateClients = await parallelPromise(rows, async row => {
                if (!clientByGuid[row[0]]) {
                    const approximateClient = await ClientAzyk.findOne({
                        del: {$ne: 'deleted'},
                        name: row[1] || 'Новый',
                        inn: row[4],
                        city: organization.cities[0],
                        'address.0.0': row[2] || '',
                        'address.0.2': row[1] || '',
                   }).select('_id').lean();
                    if (approximateClient) return {_id: approximateClient._id, guid: row[0]};
               }
                return null;
           });
            const approximateClientByGuid = {}
            for(const approximateClient of approximateClients) {
                if(approximateClient) approximateClientByGuid[approximateClient.guid] = approximateClient._id
           }
            // подготовим массив операций
            const clientBulkOperations = [];
            const integrateBulkOperations = [];
            const clientsForCreate = []
            //обработанные элементы
            const processedElements = {}
            //перебор
            for(const row of rows) {
                if(!processedElements[row[0]]) {
                    processedElements[row[0]] = true
                    //находим агента и клиента
                    let client = clientByGuid[row[0]]
                    //если нету клиента ищем примерный
                    let approximateClient
                    if (!client) {
                        approximateClient = approximateClientByGuid[row[0]]
                   }
                    const updateFields = {
                        guid: row[0],
                        name: row[1]||'Новый',
                        address: [[row[2] || '', '', row[1] || '']],
                        category: row[3]||'B',
                        inn: row[4]
                   }
                    if (!client) {
                        if (!approximateClient)
                            //создаем клиента
                            clientsForCreate.push({
                                phone: [],
                                ...updateFields
                           })
                        else
                            integrateBulkOperations.push({insertOne: {document: {client: approximateClient, organization: organization._id, guid: row[0]}}});
                   }
                    else {
                        clientBulkOperations.push({updateOne: {filter: {_id: client}, update: {$set: updateFields}}})
                   }
               }
           }
            //создаем клиентов
            await parallelPromise(clientsForCreate, async (clientForCreate) => {
                const user = await UserAzyk.create({
                    login: randomstring.generate({length: 12, charset: 'numeric'}),
                    role: 'client',
                    status: 'active',
                    password: '12345678',
               });
                const client = await ClientAzyk.create({
                    ...clientForCreate,
                    city: organization.cities[0],
                    notification: false,
                    user: user._id
               });
                integrateBulkOperations.push({insertOne: {document: {client: client._id, organization: organization._id, guid: client.guid}}});
           })
            // если есть обновления — выполним bulkWrite
            if (clientBulkOperations.length) await parallelBulkWrite(ClientAzyk, clientBulkOperations);
            if (integrateBulkOperations.length) await parallelBulkWrite(Integrate1CAzyk, integrateBulkOperations);
            await deleteFile(filename)
            return  'OK'
       }
   },
    uploadAgentRoute: async(parent, {document, agentRoute}, {user}) => {
        if (user.role === 'admin') {
            let {stream, filename} = await document;
            let xlsxpath = path.join(app.dirname, 'public', await saveFile(stream, filename));
            let rows = await readXlsxFile(xlsxpath)
            agentRoute = await AgentRouteAzyk.findById(agentRoute)
            if(agentRoute) {
                const clientGuids = rows.map(row => row.flat())
                const districtClients = await DistrictAzyk.findById(agentRoute.district).select('client').lean()
                let integrates = await Integrate1CAzyk.find({
                    organization: agentRoute.organization, guid: {$in: clientGuids}, client: {$in: districtClients}
               }).select('client guid').lean()
                const clientByGuid = {}
                for(const integrate of integrates) {
                    clientByGuid[integrate.guid] = integrate.client
               }
                agentRoute.clients = [[],[],[],[],[],[],[]]
                for(const row of rows) {
                    row.forEach((guid, idx) => {
                        if(clientByGuid[guid])
                            agentRoute.clients[idx].push(clientByGuid[guid])
                   })
               }
                await agentRoute.save()
           }
            await deleteFile(filename)
            return  'OK'
       }
   },
    uploadDistricts: async(parent, {document, organization}, {user}) => {
        if (user.role === 'admin') {
            let {stream, filename} = await document;
            let xlsxpath = path.join(app.dirname, 'public', await saveFile(stream, filename));
            let rows = await readXlsxFile(xlsxpath)
            const pullOperations = [];
            const addToSetOperations = [];
            for(const row of rows) {
                const client = row[0]
                const agent = row[1]
                if(agent&&client) {
                    pullOperations.push({
                        updateOne: {
                            filter: {client, organization},
                            update: {$pull: {client}}
                        }
                    });
                    addToSetOperations.push({
                        updateOne: {
                            filter: {agent, organization},
                            update: {$addToSet: {client}}
                        }
                    });
               }
           }
            if (pullOperations.length) await parallelBulkWrite(DistrictAzyk, pullOperations);
            if (addToSetOperations.length) await parallelBulkWrite(DistrictAzyk, addToSetOperations);
            await deleteFile(filename)
            return  'OK'
       }
   }
}

module.exports.mutation = mutation;
module.exports.resolversMutation = resolversMutation;
module.exports.query = query;
module.exports.resolvers = resolvers;