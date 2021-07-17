const OrganizationAzyk = require('../models/organizationAzyk');
const ContactAzyk = require('../models/contactAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const InvoiceAzyk = require('../models/invoiceAzyk');
const RouteAzyk = require('../models/routeAzyk');
const mongoose = require('mongoose');
const EmploymentAzyk = require('../models/employmentAzyk');
const randomstring = require('randomstring');
const { tomtom } = require('../module/const');
const axios = require('axios');
const ExcelJS = require('exceljs');
const { urlMain, pdDDMMYYYY, checkInt, checkFloat } = require('../module/const');
const app = require('../app');
const fs = require('fs');
const path = require('path');

const type = `
  type Route {
    _id: ID
    createdAt: Date
    deliverys: [Delivery]
    provider: Organization
    selectProdusers: [Organization]
    selectDistricts: [District]
    selectEcspeditor: Employment
    selectAuto: Auto
    selectedOrders: [Invoice]
    dateDelivery: Date
    status: String
    number: String
    allTonnage: Int
  }
  type Delivery {
    legs:[[String]]
    orders: [Invoice]
    tonnage: Int
    lengthInMeters: Int 
  }
  input DeliveryInput {
    legs:[[String]]
    orders: [ID]
    tonnage: Int
    lengthInMeters: Int 
  }
`;

const query = `
    routes(organization: ID, search: String!, sort: String!, filter: String!, date: String!, skip: Int): [Route]
    listDownload(orders: [ID]!): [[String]]
    listUnload(orders: [ID]!): [[String]]
    route(_id: ID!): Route
    sortRoute: [Sort]
    filterRoute: [Filter]
    unloadingInvoicesFromRouting(orders: [ID]!, organization: ID!): Data
`;

const mutation = `
    buildRoute(provider: ID!,autoTonnage: Int!, length: Int, orders: [ID]!): [Delivery],
    addRoute(deliverys: [DeliveryInput]!, provider: ID!, selectProdusers: [ID]!, selectDistricts: [ID]!, selectEcspeditor: ID!, selectAuto: ID!, selectedOrders: [ID]!, dateDelivery: Date!, allTonnage: Int!): Data,
    setRoute(route: ID!, deletedOrders: [ID]!): Data,
    deleteRoute(_id: ID!, selectedOrders: [ID]!): Data
`;

const resolvers = {
    unloadingInvoicesFromRouting: async(parent, { orders, organization }, {user}) => {
        if(['admin', 'агент', 'суперорганизация', 'организация', 'менеджер', 'экспедитор', 'суперэкспедитор'].includes(user.role)){
            if(organization!=='super') {
                organization = await OrganizationAzyk.findOne({_id: organization}).select('name address phone').lean()
            }
            else {
                organization = await ContactAzyk.findOne().select('name address phone').lean()
            }
            let workbook = new ExcelJS.Workbook();
            let data = await InvoiceAzyk.find(
                {
                    _id: {$in: orders}
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
                    path: 'organization',
                    select: 'name _id'
                })
                .populate({
                    path : 'client'
                })
                .populate({
                    path : 'adss',
                    populate: [
                        {
                            path: 'item'
                        }
                    ]
                })
                .lean()
            let worksheet;
            let items = {}
            let allCount = {}
            let allPrice = {}
            let allTonnage = {}
            let allSize = {}
            let consignation
            let consigmentOrder
            for(let i = 0; i<data.length;i++){
                for(let i1 = 0; i1<data[i].orders.length;i1++) {
                    if(!items[`${data[i].organization._id}|||${data[i].organization.name}`])
                        items[`${data[i].organization._id}|||${data[i].organization.name}`] = {}
                    if(!items[`${data[i].organization._id}|||${data[i].organization.name}`][data[i].orders[i1].item._id])
                        items[`${data[i].organization._id}|||${data[i].organization.name}`][data[i].orders[i1].item._id] = {
                            name: data[i].orders[i1].item.name,
                            count: 0,
                            allPrice: 0,
                            packaging: data[i].orders[i1].item.packaging,
                            allTonnage: 0,
                            allSize: 0
                        }
                    items[`${data[i].organization._id}|||${data[i].organization.name}`][data[i].orders[i1].item._id].count += data[i].orders[i1].count
                    items[`${data[i].organization._id}|||${data[i].organization.name}`][data[i].orders[i1].item._id].allPrice += data[i].orders[i1].allPrice
                    items[`${data[i].organization._id}|||${data[i].organization.name}`][data[i].orders[i1].item._id].allTonnage += data[i].orders[i1].allTonnage
                    items[`${data[i].organization._id}|||${data[i].organization.name}`][data[i].orders[i1].item._id].allSize += data[i].orders[i1].allSize
                    if(allCount[`${data[i].organization._id}|||${data[i].organization.name}`]===undefined){
                        allCount[`${data[i].organization._id}|||${data[i].organization.name}`] = 0
                        allPrice[`${data[i].organization._id}|||${data[i].organization.name}`] = 0
                        allTonnage[`${data[i].organization._id}|||${data[i].organization.name}`] = 0
                        allSize[`${data[i].organization._id}|||${data[i].organization.name}`] = 0 
                    }
                    allCount[`${data[i].organization._id}|||${data[i].organization.name}`] += data[i].orders[i1].count
                    allPrice[`${data[i].organization._id}|||${data[i].organization.name}`] += data[i].orders[i1].allPrice
                    allTonnage[`${data[i].organization._id}|||${data[i].organization.name}`] += data[i].orders[i1].allTonnage
                    allSize[`${data[i].organization._id}|||${data[i].organization.name}`] += data[i].orders[i1].allSize
                }
                if(data[i].adss) {
                    for (let i1 = 0; i1 < data[i].adss.length; i1++) {
                        if(data[i].adss[i1].item){
                            let count = data[i].adss[i1].count
                            if (data[i].adss[i1].multiplier) {
                                if (data[i].adss[i1].targetType === 'Цена' && data[i].adss[i1].targetPrice && data[i].adss[i1].targetPrice > 0) {
                                    count *= parseInt((data[i].allPrice-data[i].returnedPrice) / data[i].adss[i1].targetPrice)
                                }
                                else if (data[i].adss[i1].targetType === 'Товар' && data[i].adss[i1].targetItems && data[i].adss[i1].targetItems.length>0) {
                                    let index = []
                                    for(let i2=0; i2<data[i].adss[i1].targetItems.length; i2++) {
                                        if(data[i].adss[i1].targetItems[i2].sum){
                                            index[i2] = 0
                                            for(let i3=0; i3<data[i].orders.length; i3++) {
                                                if(data[i].adss[i1].targetItems[i2].xids&&data[i].adss[i1].targetItems[i2].xids.toString().includes(data[i].orders[i3].item._id.toString())) {
                                                    index[i2] += data[i].adss[i1].targetItems[i2].type==='Количество'?
                                                        data[i].orders[i3].count-data[i].orders[i3].returned
                                                        :
                                                        (data[i].orders[i3].allPrice/data[i].orders[i3].count*(data[i].orders[i3].count-data[i].orders[i3].returned))

                                                }
                                            }
                                            index[i2] = parseInt(index[i2]/(data[i].adss[i1].targetItems[i2].type==='Количество'?data[i].adss[i1].targetItems[i2].count:data[i].adss[i1].targetItems[i2].targetPrice))
                                        }
                                        else {
                                            index[i2] = []
                                            for(let i3=0; i3<data[i].orders.length; i3++) {
                                                if(
                                                    data[i].adss[i1].targetItems[i2].xids&&data[i].adss[i1].targetItems[i2].xids.toString().includes(data[i].orders[i3].item._id.toString())
                                                    &&
                                                    (
                                                        (data[i].orders[i3].count-data[i].orders[i3].returned)>=data[i].adss[i1].targetItems[i2].count&&data[i].adss[i1].targetItems[i2].type==='Количество'
                                                        ||
                                                        (data[i].orders[i3].allPrice/data[i].orders[i3].count*(data[i].orders[i3].count-data[i].orders[i3].returned))>=data[i].adss[i1].targetItems[i2].targetPrice

                                                    )
                                                ) {
                                                    index[i2].push(parseInt(
                                                        data[i].adss[i1].targetItems[i2].type==='Количество'?
                                                            (data[i].orders[i3].count-data[i].orders[i3].returned)/data[i].adss[i1].targetItems[i2].count
                                                            :
                                                            (data[i].orders[i3].allPrice/data[i].orders[i3].count*(data[i].orders[i3].count-data[i].orders[i3].returned))/data[i].adss[i1].targetItems[i2].targetPrice
                                                    ))
                                                }
                                            }
                                            if(index[i2].length)
                                                index[i2] = Math.max(...index[i2])
                                        }
                                    }
                                    if(index.length)
                                        count *= Math.min(...index)
                                }
                            }
                            if(!items[`${data[i].organization._id}|||${data[i].organization.name}`])
                                items[`${data[i].organization._id}|||${data[i].organization.name}`] = {}
                            if(!items[`${data[i].organization._id}|||${data[i].organization.name}`][data[i].adss[i1].item._id])
                                items[`${data[i].organization._id}|||${data[i].organization.name}`][data[i].adss[i1].item._id] = {
                                    name: data[i].adss[i1].item.name,
                                    count: 0,
                                    allPrice: 0,
                                    packaging: data[i].adss[i1].item.packaging,
                                    allTonnage: 0,
                                    allSize: 0
                                }
                            items[`${data[i].organization._id}|||${data[i].organization.name}`][data[i].adss[i1].item._id].count += count
                            items[`${data[i].organization._id}|||${data[i].organization.name}`][data[i].adss[i1].item._id].allTonnage += data[i].adss[i1].item.weight*count
                            items[`${data[i].organization._id}|||${data[i].organization.name}`][data[i].adss[i1].item._id].allSize += data[i].adss[i1].item.size*count
                            allCount[`${data[i].organization._id}|||${data[i].organization.name}`] += count
                            allTonnage[`${data[i].organization._id}|||${data[i].organization.name}`] += data[i].adss[i1].item.weight*count
                            allSize[`${data[i].organization._id}|||${data[i].organization.name}`] += data[i].adss[i1].item.size*count
                        }
                    }
                }
            }
            let row = 1;

            const keysOrganization = Object.keys(items)
            for(let i=0; i<keysOrganization.length; i++){
                worksheet = await workbook.addWorksheet(keysOrganization[i].split('|||')[1]);
                row = 1;
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
                if(allTonnage[keysOrganization[i]]){
                    worksheet.getCell(`E${row}`).font = {bold: true};
                    worksheet.getCell(`E${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                    worksheet.getCell(`E${row}`).value = 'Тоннаж:';
                }
                if(allSize[keysOrganization[i]]){
                    worksheet.getCell(`${allTonnage?'F':'E'}${row}`).font = {bold: true};
                    worksheet.getCell(`${allTonnage?'F':'E'}${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                    worksheet.getCell(`${allTonnage?'F':'E'}${row}`).value = 'Кубатура:';
                }
                const keys = Object.keys(items[keysOrganization[i]])
                for(let i1=0; i1<keys.length; i1++){
                    row += 1;
                    worksheet.getCell(`A${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                    worksheet.getCell(`A${row}`).alignment = { wrapText: true };
                    worksheet.getCell(`A${row}`).value = items[keysOrganization[i]][keys[i1]].name;
                    worksheet.getCell(`B${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                    worksheet.getCell(`B${row}`).value = `${items[keysOrganization[i]][keys[i1]].count} шт`;
                    worksheet.getCell(`C${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                    worksheet.getCell(`C${row}`).value = `${Math.round(items[keysOrganization[i]][keys[i1]].count/(items[keysOrganization[i]][keys[i1]].packaging?items[keysOrganization[i]][keys[i1]].packaging:1))} уп`;
                    worksheet.getCell(`D${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                    worksheet.getCell(`D${row}`).value = `${checkFloat(items[keysOrganization[i]][keys[i1]].allPrice)} сом`;
                    if(allTonnage){
                        worksheet.getCell(`E${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                        worksheet.getCell(`E${row}`).value = `${checkInt(items[keysOrganization[i]][keys[i1]].allTonnage)} кг`;
                    }
                    if(allSize){
                        worksheet.getCell(`${allTonnage?'F':'E'}${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                        worksheet.getCell(`${allTonnage?'F':'E'}${row}`).value = `${checkInt(items[keysOrganization[i]][keys[i1]].allSize)} см³`
                    }
                }
                row += 1;
                worksheet.getCell(`A${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                worksheet.getCell(`A${row}`).alignment = { wrapText: true };
                worksheet.getCell(`A${row}`).font = {bold: true};
                worksheet.getCell(`A${row}`).value = 'Итого';
                worksheet.getCell(`B${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                worksheet.getCell(`B${row}`).value = `${allCount[keysOrganization[i]]} шт`;
                worksheet.getCell(`C${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                worksheet.getCell(`C${row}`).value = '';
                worksheet.getCell(`D${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                worksheet.getCell(`D${row}`).value = `${checkFloat(allPrice[keysOrganization[i]])} сом`;
                if(allTonnage){
                    worksheet.getCell(`E${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                    worksheet.getCell(`E${row}`).value = `${checkInt(allTonnage[keysOrganization[i]])} кг`;
                }
                if(allSize){
                    worksheet.getCell(`${allTonnage?'F':'E'}${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                    worksheet.getCell(`${allTonnage?'F':'E'}${row}`).value = `${checkInt(allSize[keysOrganization[i]])} см³`
                }
            }


                worksheet = await workbook.addWorksheet('Лист магазинов');
                row = 1;
                worksheet.getColumn(1).width = 25;
                worksheet.getColumn(2).width = 15;
                worksheet.getColumn(3).width = 15;
                worksheet.getColumn(4).width = 15;
                worksheet.getColumn(5).width = 15;
                worksheet.getCell(`A${row}`).font = {bold: true};
                worksheet.getCell(`A${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                worksheet.getCell(`A${row}`).value = 'Магазин:';
                worksheet.getCell(`B${row}`).font = {bold: true};
                worksheet.getCell(`B${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                worksheet.getCell(`B${row}`).value = 'Адрес:';
                for(let i = 0; i<orders.length;i++) {
                    row+=1;
                    let index = data.findIndex(element=>element._id.toString()===orders[i].toString())
                    worksheet.getCell(`A${row}`).value = data[index].address[2];
                    worksheet.getCell(`B${row}`).value = data[index].address[0];

                }   

            for(let i = 0; i<data.length;i++){
                worksheet = await workbook.addWorksheet(`Накладная ${data[i].number}`);
                worksheet.getColumn(1).width = 25;
                worksheet.getColumn(2).width = 15;
                worksheet.getColumn(3).width = 15;
                worksheet.getColumn(4).width = 15;
                worksheet.getColumn(5).width = 15;
                row = 1;
                let date = data[i].createdAt;
                date = date.setDate(date.getDate() + 1)
                worksheet.getCell(`A${row}`).font = {bold: true, size: 14};
                worksheet.getCell(`A${row}`).value = `Накладная №${data[i].number} от ${pdDDMMYYYY(date)}`;
                row+=1;
                worksheet.getCell(`A${row}`).font = {bold: true};
                worksheet.getCell(`A${row}`).value = 'Продавец:';
                worksheet.getCell(`B${row}`).value = organization.name;
                if(organization.address&&organization.address.length>0) {
                    row += 1;
                    worksheet.getCell(`A${row}`).font = {bold: true};
                    worksheet.getCell(`A${row}`).value = 'Адрес продавца:';
                    worksheet.getCell(`B${row}`).value = `${organization.address.toString()}`;
                }
                if(organization.phone&&organization.phone.length>0){
                    row+=1;
                    worksheet.getCell(`A${row}`).font = {bold: true};
                    worksheet.getCell(`A${row}`).value = 'Телефон продавца:';
                    worksheet.getCell(`B${row}`).value = organization.phone.toString();
                }
                row+=1;
                worksheet.getCell(`A${row}`).font = {bold: true};
                worksheet.getCell(`A${row}`).value = 'Получатель:';
                worksheet.getCell(`B${row}`).value = data[i].client.name;
                row+=1;
                worksheet.getCell(`A${row}`).font = {bold: true};
                worksheet.getCell(`A${row}`).value = 'Адрес получателя:';
                worksheet.getCell(`B${row}`).value = `${data[i].address[2] ? `${data[i].address[2]}, ` : ''}${data[i].address[0]}`;
                for(let i1=0; i1<data[i].client.phone.length; i1++) {
                    row+=1;
                    if(!i1) {
                        worksheet.getCell(`A${row}`).font = {bold: true};
                        worksheet.getCell(`A${row}`).value = 'Телефон получателя:';
                    }
                    worksheet.getCell(`B${row}`).value = data[i].client.phone[i1];
                }
                consignation = 0
                consigmentOrder = await InvoiceAzyk.find({consignmentPrice: {$gt: 0}, paymentConsignation: {$ne: true}, client: data[i].client._id}).select('consignmentPrice').lean()
                for(let i1 = 0; i1<consigmentOrder.length;i1++){
                    consignation+=consigmentOrder[i1].consignmentPrice
                }
                if(consignation){
                    row+=1;
                    worksheet.getCell(`A${row}`).font = {bold: true};
                    worksheet.getCell(`A${row}`).value = 'Всего консигнаций:';
                    worksheet.getCell(`B${row}`).value = `${consignation} сом`;
                }
                if(data[i].adss) {
                    row+=1;
                    for(let i1=0; i1<data[i].adss.length; i1++) {
                        row+=1;
                        if(!i1) {
                            worksheet.getCell(`A${row}`).font = {bold: true};
                            worksheet.getCell(`A${row}`).value = 'Акция:';
                        }
                        worksheet.getCell(`B${row}`).value = data[i].adss[i1].title;
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
                if(data[i].consignmentPrice>0) {
                    worksheet.getCell(`F${row}`).font = {bold: true};
                    worksheet.getCell(`F${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                    worksheet.getCell(`F${row}`).value = 'Консигнации:';
                }
                for(let i1=0; i1<data[i].orders.length; i1++) {
                    row += 1;
                    worksheet.getCell(`A${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                    worksheet.getCell(`A${row}`).alignment = { wrapText: true };
                    worksheet.getCell(`A${row}`).value = data[i].orders[i1].item.name;
                    worksheet.getCell(`B${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                    worksheet.getCell(`B${row}`).value = `${data[i].orders[i1].item.price} сом`;
                    worksheet.getCell(`C${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                    worksheet.getCell(`C${row}`).value = `${data[i].orders[i1].count} шт`;
                    worksheet.getCell(`D${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                    worksheet.getCell(`D${row}`).value = `${Math.round(data[i].orders[i1].count/(data[i].orders[i1].item.packaging?data[i].orders[i1].item.packaging:1))} уп`;
                    worksheet.getCell(`E${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                    worksheet.getCell(`E${row}`).value = `${data[i].orders[i1].allPrice} сом`;
                    if(data[i].orders[i1].consignmentPrice>0) {
                        worksheet.getCell(`F${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                        worksheet.getCell(`F${row}`).value = `${data[i].orders[i1].consignmentPrice} сом`;
                    }
                }
                if(data[i].adss) {
                    for(let i1=0; i1<data[i].adss.length; i1++) {
                        let count = data[i].adss[i1].count
                        if(data[i].adss[i1].multiplier){
                            if(data[i].adss[i1].targetType==='Цена'&&data[i].adss[i1].targetPrice&&data[i].adss[i1].targetPrice>0){
                                count *= parseInt((data[i].allPrice-data[i].returnedPrice) / data[i].adss[i1].targetPrice)
                            }
                            else if(data[i].adss[i1].targetType==='Товар'&&data[i].adss[i1].targetItems&&data[i].adss[i1].targetItems.length>0){
                                let index = []
                                for(let i2=0; i2<data[i].adss[i1].targetItems.length; i2++) {
                                    if(data[i].adss[i1].targetItems[i2].sum){
                                        index[i2] = 0
                                        for(let i3=0; i3<data[i].orders.length; i3++) {
                                            if(data[i].adss[i1].targetItems[i2].xids.toString().includes(data[i].orders[i3].item._id.toString())) {
                                                index[i2] += data[i].adss[i1].targetItems[i2].type==='Количество'?
                                                    data[i].orders[i3].count-data[i].orders[i3].returned
                                                    :
                                                    (data[i].orders[i3].allPrice/data[i].orders[i3].count*(data[i].orders[i3].count-data[i].orders[i3].returned))
                                            }
                                        }
                                        index[i2] = parseInt(index[i2]/(data[i].adss[i1].targetItems[i2].type==='Количество'?data[i].adss[i1].targetItems[i2].count:data[i].adss[i1].targetItems[i2].targetPrice))
                                    }
                                    else {
                                        index[i2] = []
                                        for(let i3=0; i3<data[i].orders.length; i3++) {
                                            if(
                                                data[i].adss[i1].targetItems[i2].xids.toString().includes(data[i].orders[i3].item._id.toString())
                                                &&
                                                (
                                                    (data[i].orders[i3].count-data[i].orders[i3].returned)>=data[i].adss[i1].targetItems[i2].count&&data[i].adss[i1].targetItems[i2].type==='Количество'
                                                    ||
                                                    (data[i].orders[i3].allPrice/data[i].orders[i3].count*(data[i].orders[i3].count-data[i].orders[i3].returned))>=data[i].adss[i1].targetItems[i2].targetPrice

                                                )
                                            ) {
                                                index[i2].push(parseInt(
                                                    data[i].adss[i1].targetItems[i2].type==='Количество'?
                                                        (data[i].orders[i3].count-data[i].orders[i3].returned)/data[i].adss[i1].targetItems[i2].count
                                                        :
                                                        (data[i].orders[i3].allPrice/data[i].orders[i3].count*(data[i].orders[i3].count-data[i].orders[i3].returned))/data[i].adss[i1].targetItems[i2].targetPrice
                                                ))
                                            }
                                        }
                                        if(index[i2].length)
                                            index[i2] = Math.max(...index[i2])
                                    }
                                }
                                if(index.length)
                                    count *= Math.min(...index)
                            }
                        }
                        row+=1;
                        worksheet.getCell(`A${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                        worksheet.getCell(`A${row}`).alignment = { wrapText: true };
                        worksheet.getCell(`A${row}`).value = `Акционный ${data[i].adss[i1].item.name}`;
                        worksheet.getCell(`B${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                        worksheet.getCell(`B${row}`).value = `${data[i].adss[i1].item.price} сом`;
                        worksheet.getCell(`C${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                        worksheet.getCell(`C${row}`).value = `${count} шт`;
                        worksheet.getCell(`D${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                        worksheet.getCell(`D${row}`).value = `${Math.round(count/(data[i].adss[i1].item.packaging?data[i].adss[i1].item.packaging:1))} уп`;
                        worksheet.getCell(`E${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                        worksheet.getCell(`E${row}`).value = '0 сом';
                    }
                }

                row+=1;
                worksheet.getCell(`D${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                worksheet.getCell(`D${row}`).font = {bold: true};
                worksheet.getCell(`D${row}`).value = 'Сумма:';
                worksheet.getCell(`E${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
                worksheet.getCell(`E${row}`).value = `${data[i].allPrice} сом`;
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
            if (!await fs.existsSync(xlsxdir)){
                await fs.mkdirSync(xlsxdir);
            }
            let xlsxpath = path.join(app.dirname, 'public', 'xlsx', xlsxname);
            await workbook.xlsx.writeFile(xlsxpath);
            return({data: urlMain + '/xlsx/' + xlsxname})
        }
    },
    listDownload: async(parent, {orders}, {user}) => {
        if(['admin', 'агент', 'суперорганизация', 'организация', 'суперэкспедитор', 'экспедитор', 'менеджер'].includes(user.role)){
            orders = await InvoiceAzyk.find({_id: {$in: orders}})
                .select('orders allPrice adss')
                .populate({
                    path: 'orders',
                    select: 'item count returned allPrice',
                    populate: {
                        path: 'item',
                        select: 'name _id'
                    }
                })
                .populate({
                    path: 'organization',
                    select: 'name _id'
                })
                .populate({
                    path : 'adss',
                    populate: [
                        {
                            path: 'item',
                            select: 'name _id'
                        }
                    ]
                })
                .sort('organization')
                .lean()
            let list = {}
            for(let i = 0; i<orders.length;i++){
                for(let i1 = 0; i1<orders[i].orders.length;i1++) {
                    if(!list[orders[i].orders[i1].item._id])
                        list[orders[i].orders[i1].item._id] = [orders[i].orders[i1].item.name, 0, orders[i].organization.name]
                    list[orders[i].orders[i1].item._id][1] += orders[i].orders[i1].count
                }
                if(orders[i].adss) {
                    for (let i1 = 0; i1 < orders[i].adss.length; i1++) {
                        if(orders[i].adss[i1].item){
                            let count = orders[i].adss[i1].count
                            if (orders[i].adss[i1].multiplier) {
                                if (orders[i].adss[i1].targetType === 'Цена' && orders[i].adss[i1].targetPrice && orders[i].adss[i1].targetPrice > 0) {
                                    count *= parseInt((orders[i].allPrice-orders[i].returnedPrice) / orders[i].adss[i1].targetPrice)
                                }
                                else if (orders[i].adss[i1].targetType === 'Товар' && orders[i].adss[i1].targetItems && orders[i].adss[i1].targetItems.length>0) {
                                    let index = []
                                    for(let i2=0; i2<orders[i].adss[i1].targetItems.length; i2++) {
                                        if(orders[i].adss[i1].targetItems[i2].sum){
                                            index[i2] = 0
                                            for(let i3=0; i3<orders[i].orders.length; i3++) {
                                                if(orders[i].adss[i1].targetItems[i2].xids&&orders[i].adss[i1].targetItems[i2].xids.toString().includes(orders[i].orders[i3].item._id.toString())) {
                                                    index[i2] += orders[i].adss[i1].targetItems[i2].type==='Количество'?
                                                        orders[i].orders[i3].count-orders[i].orders[i3].returned
                                                        :
                                                        (orders[i].orders[i3].allPrice/orders[i].orders[i3].count*(orders[i].orders[i3].count-orders[i].orders[i3].returned))
                                                }
                                            }
                                            index[i2] = parseInt(index[i2]/(orders[i].adss[i1].targetItems[i2].type==='Количество'?orders[i].adss[i1].targetItems[i2].count:orders[i].adss[i1].targetItems[i2].targetPrice))
                                        }
                                        else {
                                            index[i2] = []
                                            for(let i3=0; i3<orders[i].orders.length; i3++) {
                                                if(
                                                    orders[i].adss[i1].targetItems[i2].xids&&orders[i].adss[i1].targetItems[i2].xids.toString().includes(orders[i].orders[i3].item._id.toString())
                                                    &&
                                                    (
                                                        (orders[i].orders[i3].count-orders[i].orders[i3].returned)>=orders[i].adss[i1].targetItems[i2].count&&orders[i].adss[i1].targetItems[i2].type==='Количество'
                                                        ||
                                                        (orders[i].orders[i3].allPrice/orders[i].orders[i3].count*(orders[i].orders[i3].count-orders[i].orders[i3].returned))>=orders[i].adss[i1].targetItems[i2].targetPrice

                                                    )
                                                ) {
                                                    index[i2].push(parseInt(
                                                        orders[i].adss[i1].targetItems[i2].type==='Количество'?
                                                            (orders[i].orders[i3].count-orders[i].orders[i3].returned)/orders[i].adss[i1].targetItems[i2].count
                                                            :
                                                            (orders[i].orders[i3].allPrice/orders[i].orders[i3].count*(orders[i].orders[i3].count-orders[i].orders[i3].returned))/orders[i].adss[i1].targetItems[i2].targetPrice
                                                    ))
                                                }
                                            }
                                            if(index[i2].length)
                                                index[i2] = Math.max(...index[i2])
                                        }
                                    }

                                    if(index.length)
                                        count *= Math.min(...index)
                                }
                            }
                            if(!list[orders[i].adss[i1].item._id])
                                list[orders[i].adss[i1].item._id] = [orders[i].adss[i1].item.name, 0, orders[i].organization.name]
                            list[orders[i].adss[i1].item._id][1] += count
                        }
                    }
                }
            }
            list = Object.values(list)
            return list
        }
    },
    listUnload: async(parent, {orders}, {user}) => {
        if(['admin', 'агент', 'суперорганизация', 'организация', 'менеджер'].includes(user.role)){
            orders = await InvoiceAzyk.find({_id: {$in: orders}})
                .select('orders')
                .populate({
                    path: 'orders',
                    select: 'item returned',
                    populate: {
                        path: 'item',
                        select: 'name'
                    }
                })
                .lean()
            let list = []
            for(let i=0; i<orders.length; i++){
                for(let i1=0; i1<orders[i].orders.length; i1++) {
                    if(!list[orders[i].orders[i1].item._id])
                        list[orders[i].orders[i1].item._id] = [orders[i].orders[i1].item.name, 0]
                    list[orders[i].orders[i1].item._id][1] += orders[i].orders[i1].returned
                }
            }
            return Object.values(list)
        }
    },
    routes: async(parent, {organization, search, sort, filter, date, skip}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'агент', 'admin', 'экспедитор', 'суперэкспедитор'].includes(user.role)) {
            let dateStart;
            let dateEnd;
            let _employments;
            let district
            if(search.length>0){
                _employments = await EmploymentAzyk.find({
                    name: {'$regex': search, '$options': 'i'}
                }).distinct('_id').lean()
            }
            if(['менеджер', 'агент'].includes(user.role)) {
                district = await DistrictAzyk.find({
                    agent: user.employment
                }).distinct('_id').lean()
            }
            return await RouteAzyk.find({
                provider: user.organization?user.organization:organization==='super'?null:organization,
                status: {'$regex': filter, '$options': 'i'},
                ...(search.length > 0 ? {selectEcspeditor: {$in: _employments}} : {}),
                ...date === '' ? {} : {$and: [{createdAt: {$gte: dateStart}}, {createdAt: {$lt: dateEnd}}]},
                ...'агент'===user.role?{selectDistricts: {$in: district}}:{},
                ...['экспедитор', 'суперэкспедитор'].includes(user.role)?{selectEcspeditor: user.employment}:{}
            })
                .populate({
                    path: 'selectEcspeditor',
                    select: 'name'
                })
                .sort(sort)
                .skip(skip != undefined ? skip : 0)
                .limit(skip != undefined ? 15 : 10000000000)
                .lean()

        }
    },
    route: async(parent, {_id}, {user}) => {
        if(mongoose.Types.ObjectId.isValid(_id)) {
            let route = await RouteAzyk.findOne({_id: _id})
                .populate({
                    path: 'selectEcspeditor',
                    select: 'name _id'
                })
                .populate({
                    path: 'selectAuto',
                    select: 'number _id'
                })
                .populate({
                    path: 'provider',
                    select: 'name _id'
                })
                .populate({
                    path: 'selectProdusers',
                    select: 'name _id'
                })
                .populate({
                    path: 'selectDistricts',
                    select: 'name _id'
                })
                .populate({
                    path: 'selectedOrders',
                    select: '_id agent createdAt updatedAt allTonnage allSize client allPrice consignmentPrice returnedPrice address adss editor number confirmationForwarder confirmationClient cancelClient district track forwarder  sale provider organization cancelForwarder paymentConsignation taken sync dateDelivery',
                    populate:  [
                        {path: 'client', select: '_id name'},
                        {path: 'agent', select: '_id name'},
                        {path: 'forwarder', select: '_id name'},
                        {path: 'provider', select: '_id name'},
                        {path: 'sale', select: '_id name'},
                        {path: 'adss', select: '_id title'},
                        {path: 'organization', select: '_id name'}
                    ]

                })
                .lean()
            if (route &&
                (
                    ['admin', 'суперэкспедитор'].includes(user.role) ||
                    (user.role === 'экспедитор' && route.selectEcspeditor._id.toString() === user.employment.toString()) ||
                    (['суперорганизация', 'организация', 'менеджер', 'агент'].includes(user.role) && route.provider._id.toString() === user.organization.toString())
                )
            ) {
                for(let i=0; i<route.deliverys.length; i++) {
                    for(let i1=0; i1<route.deliverys[i].orders.length; i1++) {
                        route.deliverys[i].orders[i1] = route.selectedOrders[route.selectedOrders.findIndex(selectedOrder=>selectedOrder._id.toString()===route.deliverys[i].orders[i1].toString())]
                    }
                }
                return route
            }
            else
                return null
        }
        else return null
    },
    sortRoute: async() => {
        let sort = [
            {
                name: 'Дата',
                field: 'dateDelivery'
            },
            {
                name: 'Статус',
                field: 'status'
            },
            {
                name: 'Тоннаж',
                field: 'allTonnage'
            }
        ]
        return sort
    },
    filterRoute: async() => {
        let filter = [
            {
                name: 'Все',
                value: ''
            },
            {
                name: 'Cоздан',
                value: 'создан'
            },
            {
                name: 'Выполняется',
                value: 'выполняется'
            },
            {
                name: 'Выполнен',
                value: 'выполнен'
            }
        ]
        return filter
    },
};

const resolversMutation = {
    buildRoute: async(parent, {provider, autoTonnage, orders, length}, {user}) => {
        if(['admin', 'агент', 'суперорганизация', 'организация', 'менеджер'].includes(user.role)){
            if(provider!=='super')
                provider = (await OrganizationAzyk.findOne({_id: provider}).select('warehouse').lean()).warehouse.replace(', ', ',');
            else
                provider = (await ContactAzyk.findOne().select('warehouse').lean()).warehouse.replace(', ', ',');
            if(provider&&provider.length>0){
                let invoices = await InvoiceAzyk.find({_id: {$in: orders}}).lean();
                length = !length||invoices.length<=length?0:invoices.length-length;
                let currentLength = invoices.length
                let firstInvoices = []
                for(let i=0; i<invoices.length; i++) {
                    if(invoices[i].priority===1) {
                        firstInvoices.push(invoices[i])
                        invoices.splice(i, 1)
                        i--
                    }
                }
                let delivery = [];
                let deliveryIndex = 0
                let sortInvoices = [];
                let points = provider
                let tonnage = 0
                let res

                while(firstInvoices.length&&currentLength>length){
                    delivery[deliveryIndex] = {orders: [], legs: []}
                    sortInvoices = [];
                    points = provider
                    tonnage = 0
                    for(let i=0; i<firstInvoices.length; i++) {
                        points+= `:${firstInvoices[i].address[1].replace(', ', ',')}`
                    }
                    points+=`:${provider}`
                    res = await axios.get(`https://api.tomtom.com/routing/1/calculateRoute/${points}/json?computeBestOrder=true&routeType=shortest&sectionType=traffic&traffic=true&key=${tomtom}`)
                    for(let i=0; i<res.data.optimizedWaypoints.length; i++) {
                        sortInvoices[res.data.optimizedWaypoints[i].providedIndex] = firstInvoices[res.data.optimizedWaypoints[i].optimizedIndex]
                    }
                    for(let i=0; i<sortInvoices.length; i++) {
                        if(tonnage+sortInvoices[i].allTonnage<autoTonnage/*&&currentLength>length*/) {
                            tonnage += sortInvoices[i].allTonnage
                            delivery[deliveryIndex].orders.push(sortInvoices[i])
                            firstInvoices.splice(firstInvoices.findIndex(element=>sortInvoices[i]._id===element._id), 1)
                            currentLength--
                        }
                    }

                    if(tonnage<autoTonnage){
                        let secondPoints = res.data.routes[0].legs[res.data.routes[0].legs.length-2].points[res.data.routes[0].legs[res.data.routes[0].legs.length-2].points.length-1]
                        secondPoints = `${secondPoints.latitude},${secondPoints.longitude}`
                        for(let i=0; i<invoices.length; i++) {
                            secondPoints += `:${invoices[i].address[1].replace(', ', ',')}`
                        }
                        secondPoints+=`:${provider}`
                        res = await axios.get(`https://api.tomtom.com/routing/1/calculateRoute/${secondPoints}/json?computeBestOrder=true&routeType=shortest&sectionType=traffic&traffic=true&key=${tomtom}`)
                        sortInvoices = []
                        for(let i=0; i<res.data.optimizedWaypoints.length; i++) {
                            sortInvoices[res.data.optimizedWaypoints[i].providedIndex] = invoices[res.data.optimizedWaypoints[i].optimizedIndex]
                        }
                        for(let i=0; i<sortInvoices.length; i++) {
                            if(tonnage+sortInvoices[i].allTonnage<autoTonnage/*&&currentLength>length*/) {
                                tonnage += sortInvoices[i].allTonnage
                                delivery[deliveryIndex].orders.push(sortInvoices[i])
                                invoices.splice(invoices.findIndex(element=>sortInvoices[i]._id===element._id), 1)
                                currentLength--
                            }
                        }

                    }

                    points = provider
                    for(let i=0; i<delivery[deliveryIndex].orders.length; i++) {
                        points+= `:${delivery[deliveryIndex].orders[i].address[1].replace(', ', ',')}`
                    }
                    points+=`:${provider}`
                    res = await axios.get(`https://api.tomtom.com/routing/1/calculateRoute/${points}/json?computeBestOrder=true&routeType=shortest&sectionType=traffic&traffic=true&key=${tomtom}`)
                    delivery[deliveryIndex].tonnage = parseInt(tonnage)
                    delivery[deliveryIndex].lengthInMeters = res.data.routes[0].summary.lengthInMeters
                    for(let i=0; i<res.data.routes[0].legs.length; i++){
                        delivery[deliveryIndex].legs.push(res.data.routes[0].legs[i].points.map(element=>`${element.latitude}, ${element.longitude}`))
                    }
                    deliveryIndex+=1
                }

                while(currentLength>length){
                    delivery[deliveryIndex] = {orders: [], legs: []}
                    sortInvoices = [];
                    points = provider
                    tonnage = 0
                    for(let i=0; i<invoices.length; i++) {
                        points+= `:${invoices[i].address[1].replace(', ', ',')}`
                    }
                    points+=`:${provider}`
                    res = await axios.get(`https://api.tomtom.com/routing/1/calculateRoute/${points}/json?computeBestOrder=true&routeType=shortest&sectionType=traffic&traffic=true&key=${tomtom}`)
                    for(let i=0; i<res.data.optimizedWaypoints.length; i++) {
                        sortInvoices[res.data.optimizedWaypoints[i].providedIndex] = invoices[res.data.optimizedWaypoints[i].optimizedIndex]
                    }
                    for(let i=0; i<sortInvoices.length; i++) {
                        if(tonnage+sortInvoices[i].allTonnage<autoTonnage/*&&currentLength>length*/) {
                            tonnage += sortInvoices[i].allTonnage
                            delivery[deliveryIndex].orders.push(sortInvoices[i])
                            invoices.splice(invoices.findIndex(element=>sortInvoices[i]._id===element._id), 1)
                            currentLength--
                        }
                    }
                    points = provider
                    for(let i=0; i<delivery[deliveryIndex].orders.length; i++) {
                        points+= `:${delivery[deliveryIndex].orders[i].address[1].replace(', ', ',')}`
                    }
                    points+=`:${provider}`
                    res = await axios.get(`https://api.tomtom.com/routing/1/calculateRoute/${points}/json?computeBestOrder=true&routeType=shortest&sectionType=traffic&traffic=true&key=${tomtom}`)
                    delivery[deliveryIndex].tonnage = parseInt(tonnage)
                    delivery[deliveryIndex].lengthInMeters = res.data.routes[0].summary.lengthInMeters
                    for(let i=0; i<res.data.routes[0].legs.length; i++){
                        delivery[deliveryIndex].legs.push(res.data.routes[0].legs[i].points.map(element=>`${element.latitude}, ${element.longitude}`))
                    }
                    deliveryIndex+=1
                }
                return delivery
            }

        }
        return {data: 'OK'};
    },
    setRoute: async(parent, {route, deletedOrders}, {user}) => {
        if(['admin', 'агент', 'суперорганизация', 'организация', 'менеджер', 'экспедитор', 'суперэкспедитор'].includes(user.role)){
            route = await RouteAzyk.findOne({_id: route, ...user.organization?{provider: user.organization}:{}})
            if(route){
                for (let i = 0; i < deletedOrders.length; i++) {
                    for (let i1 = 0; i1 < route.selectedOrders.length; i1++) {
                        if(route.selectedOrders[i1]==deletedOrders[i]){
                            route.selectedOrders.splice(i1, 1);
                            break;
                        }
                    }
                    for (let i1 = 0; i1 < route.deliverys.length; i1++) {
                        for (let i2 = 0; i2 < route.deliverys[i1].orders.length; i2++) {
                            if(route.deliverys[i1].orders[i2]==deletedOrders[i]){
                                route.deliverys[i1].orders.splice(i2, 1);
                                route.deliverys[i1].legs.splice(i2, 1);
                                break;
                            }
                        }
                    }

                }
                await InvoiceAzyk.updateMany({_id: {$in: deletedOrders}}, {distributed: false})
                await route.save()
            }
        }
        return {data: 'OK'};
    },
    addRoute: async(parent, {deliverys, provider, selectProdusers, selectDistricts, selectEcspeditor, selectAuto, selectedOrders, dateDelivery, allTonnage}, {user}) => {
        if(['admin', 'агент', 'суперорганизация', 'организация', 'менеджер'].includes(user.role)){
            let number = await randomstring.generate({length: 12, charset: 'numeric'});
            while (await RouteAzyk.findOne({number: number}).select('_id').lean())
                number = await randomstring.generate({length: 12, charset: 'numeric'});
            let _object = new RouteAzyk({
                deliverys: deliverys,
                provider: provider!=='super'?provider:null,
                selectProdusers: selectProdusers,
                selectDistricts: selectDistricts.filter(selectDistrict=>selectDistrict!=='super'),
                selectEcspeditor: selectEcspeditor,
                selectAuto: selectAuto,
                selectedOrders: selectedOrders,
                dateDelivery: dateDelivery,
                status: 'Cоздан',
                number: number,
                allTonnage: allTonnage
            });
            await RouteAzyk.create(_object);
            await InvoiceAzyk.updateMany({_id: {$in: selectedOrders}}, {distributed: true})
        }
        return {data: 'OK'};
    },
    deleteRoute: async(parent, { _id, selectedOrders }, {user}) => {
        if(!['экспедитор', 'суперэкспедитор'].includes(user.role)){
            await RouteAzyk.deleteMany({_id: _id})
            await InvoiceAzyk.updateMany({_id: {$in: selectedOrders}}, {distributed: false})
        }
        return {data: 'OK'}
    }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;