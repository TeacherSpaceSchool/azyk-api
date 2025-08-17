const Integrate1CAzyk = require('../models/integrate1CAzyk');
const ClientAzyk = require('../models/clientAzyk');
const app = require('../app');
const path = require('path');
const {saveFile, deleteFile, checkFloat, formatAmount} = require('../module/const');
const readXlsxFile = require('read-excel-file/node');
const os = require('os');
const mongoose = require('mongoose');

const query = `
    statisticDevice(filter: String): Statistic
    statisticStorageSize: Statistic
    statisticClientCity: Statistic
    checkIntegrateClient(organization: ID, type: String, document: Upload): Statistic
    statisticRAM: [String]
`;

const resolvers = {
    statisticDevice: async(parent, {filter}, {user}) => {
        if(['admin'].includes(user.role)) {
            let statistic = {}
            let data = await ClientAzyk.find({device: {$ne: null}})
                .select('device')
                .lean()
            let device = ''
            for(let i=0; i<data.length; i++) {
                if(filter==='device')
                    device = data[i].device.split(' | ')[0]
                else if(filter==='os')
                    device = data[i].device.split(' | ')[1].split('-')[0]
                else if(filter==='os-version')
                    device = data[i].device.split(' | ')[1]
                else if(filter==='browser')
                    device = data[i].device.split(' | ')[2].split('-')[0]
                else if(filter==='browser-version')
                    device = data[i].device.split(' | ')[2]
                else if(filter==='company') {
                    device = data[i].device.toLowerCase()
                    if(device.includes('apple'))
                        device = 'Apple'
                    else if(device.includes('redmi')||device.includes('mi')||device.includes('xiaomi')||device.includes('m2003j15sc')||device.includes('m2004j19c')||device.includes('poco')||device.includes('pocophone'))
                        device = 'Xiaomi'
                    else if(device.includes('m5s')||device.includes('meizu'))
                        device = 'Meizu'
                    else if(device.includes('samsung'))
                        device = 'Samsung'
                    else if(device.includes('atu-l31')||device.includes('jmm-l22')||device.includes('mar-lx1m')||device.includes('mrd-lx1f')||device.includes('jat-lx1')||device.includes('fla-lx1')||device.includes('huawei')||device.includes('fig-lx1')||device.includes('lld-l31')||device.includes('honor')||device.includes('pra-la1')||device.includes('mya-l22')||device.includes('vtr-l29')||device.includes('jsn-l21')||device.includes('bkl-l09')||device.includes('aum-l29'))
                        device = 'Huawei'
                    else if(device.includes('x64')||device.includes('x86'))
                        device = 'Windows'
                    else if(device.includes('lg')||device.includes('lm-x210'))
                        device = 'LG'
                    else if(device.includes('vivo'))
                        device = 'Vivo'
                    else if(device.includes('htc'))
                        device = 'HTC'
                    else if(device.includes('m100 build/o11019'))
                        device = 'Oppo'
                    else if(device.includes('sony'))
                        device = 'Sony'
                    else if(device.includes('zte'))
                        device = 'ZTE'
                    else if(device.includes('oneplus')||device.includes('gm1910'))
                        device = 'OnePlus'
                    else if(device.includes('lenovo'))
                        device = 'Lenovo'
               }
                if(device&&device.length) {
                    if (!statistic[device]) statistic[device] = {count: 0, name: device}
                    statistic[device].count += 1
               }
           }
            const keys = Object.keys(statistic)
            data = []
            for(let i=0; i<keys.length; i++) {
                data.push({
                    _id: keys[i],
                    data: [
                        statistic[keys[i]].name,
                        formatAmount(statistic[keys[i]].count),
                    ]
               })
           }
            data = data.sort(function(a, b) {
                return checkFloat(b.data[1]) - checkFloat(a.data[1])
           });
            return {
                columns: ['девайс', 'количество'],
                row: data
           };
       }
   },
    statisticStorageSize: async(parent, ctx, {user}) => {
        if(['admin'].includes(user.role)) {
            let allSize = 0
            let allCount = 0
            let mbSize = 1048576
            let data = []
            let collectionsInfo = await mongoose.connection.db.listCollections().toArray()
            collectionsInfo = collectionsInfo.filter(collectionInfo => collectionInfo.name.includes('azyk'))
            for (const collectionInfo of collectionsInfo) {
                const name = collectionInfo.name
                const stats = await mongoose.connection.db.collection(name).stats()
                const size = checkFloat(stats.storageSize / mbSize)
                allSize += size
                allCount += stats.count
                data.push({
                    _id: name,
                    data: [name, formatAmount(size), formatAmount(stats.count)]
               })
           }
            data = data.sort(function(a, b) {
                return checkFloat(b.data[1]) - checkFloat(a.data[1])
           });
            data = [
                {
                    _id: 'Всего',
                    data: [
                        formatAmount(checkFloat(allSize)),
                        formatAmount(allCount)
                    ]
               },
                ...data
            ]
            return {
                columns: ['коллекция', 'размер(MB)', 'количество(шт)'],
                row: data
           };
       }
   },
    statisticClientCity: async(parent, ctx, {user}) => {
        if(['admin'].includes(user.role)) {
            let data = {}
            let clients = await ClientAzyk.find({
                del: {$ne: 'deleted'},
           }).select('city').lean()
            let allCount = clients.length

            for(const client of clients) {
                if(!data[client.city]) data[client.city] = {_id: client._id, data: [client.city, 0]}
                data[client.city].data[1] += 1
           }

            data = Object.values(data)

            data = data.sort(function(a, b) {
                return b.data[1] - a.data[1]
           });
            data = [
                {
                    _id: 'Всего',
                    data: [
                        allCount
                    ]
               },
                ...data
            ]
            return {
                columns: ['город', 'клиентов(шт)'],
                row: data
           };
       }
   },
    checkIntegrateClient: async(parent, {organization, type, document}, {user}) => {
        if(user.role==='admin') {
            if(type!=='отличая от 1С') {
                let statistic = [];
                let sortStatistic = {};
                let data = await Integrate1CAzyk.find(
                    {
                        organization,
                        client: {$ne: null},
                   }
                )
                    .select('guid client')
                    .populate({
                        path: 'client',
                        select: '_id address'
                   })
                    .lean()
                for(let i = 0; i < data.length; i++) {
                    if (type === 'повторяющиеся guid') {
                        if(!sortStatistic[data[i].guid])
                            sortStatistic[data[i].guid] = []
                        sortStatistic[data[i].guid].push(data[i])
                   }
                    else if (type === 'повторящиеся клиенты') {
                        if(!sortStatistic[data[i].client._id.toString()])
                            sortStatistic[data[i].client._id.toString()] = []
                        sortStatistic[data[i].client._id.toString()].push(data[i])
                   }
                    else {
                        if (data[i].client.address && data[i].client.address[0] && data[i].client.address[0][2]) {
                            let market = data[i].client.address[0][2].toLowerCase()
                            while (market.includes(' '))
                                market = market.replace(' ', '');
                            while (market.includes('-'))
                                market = market.replace('-', '');
                            if(!sortStatistic[market])
                                sortStatistic[market] = []
                            sortStatistic[market].push(data[i])
                       }
                   }
               }
                const keys = Object.keys(sortStatistic)
                for(let i = 0; i < keys.length; i++) {
                    if(sortStatistic[keys[i]].length>1) {
                        for(let i1 = 0; i1 < sortStatistic[keys[i]].length; i1++) {
                            statistic.push({
                                _id: `${i}${i1}`, data: [
                                    sortStatistic[keys[i]][i1].guid,
                                    `${sortStatistic[keys[i]][i1].client.address && sortStatistic[keys[i]][i1].client.address[0] ? `${sortStatistic[keys[i]][i1].client.address[0][2] ? `${sortStatistic[keys[i]][i1].client.address[0][2]}, ` : ''}${sortStatistic[keys[i]][i1].client.address[0][0]}` : ''}`,
                                ]
                           })
                       }
                   }
               }

                if (type === 'повторяющиеся guid') {
                    statistic = statistic.sort(function (a, b) {
                        return a.data[0] - b.data[0]
                   });
               }
                else {
                    statistic = statistic.sort(function (a, b) {
                        return a.data[1] - b.data[1]
                   });
               }

                return {
                    columns: ['GUID', 'клиент'],
                    row: statistic
               };
           }
            else if(document) {
                let {stream, filename} = await document;
                let xlsxpath = path.join(app.dirname, 'public', await saveFile(stream, filename))
                let rows = await readXlsxFile(xlsxpath);
                let statistic = [];
                let problem;
                for(let i = 0; i < rows.length; i++) {
                    let integrate1CAzyk = await Integrate1CAzyk.findOne({
                        organization,
                        guid: rows[i][0]
                   })
                        .select('guid client')
                        .populate({
                            path: 'client'
                       })
                        .lean()
                    if(integrate1CAzyk&&integrate1CAzyk.client.address[0]&&integrate1CAzyk.client.address[0][2]) {
                        let market = rows[i][1].toString().toLowerCase()
                        while (market.includes(' '))
                            market = market.replace(' ', '')
                        while (market.includes('-'))
                            market = market.replace('-', '')
                        let market1 = integrate1CAzyk.client.address[0][2].toLowerCase()
                        while (market1.includes(' '))
                            market1 = market1.replace(' ', '')
                        while (market1.includes('-'))
                            market1 = market1.replace('-', '')
                        problem = market!==market1
                        if (problem) {
                            statistic.push({
                                _id: i, data: [
                                    integrate1CAzyk.guid,
                                    `${integrate1CAzyk.client.address && integrate1CAzyk.client.address[0] ? `${integrate1CAzyk.client.address[0][2] ? `${integrate1CAzyk.client.address[0][2]}, ` : ''}${integrate1CAzyk.client.address[0][0]}` : ''}`,
                                    rows[i][1]
                                ]
                           })
                       }
                   }
               }
                await deleteFile(filename)
                return {
                    columns: ['GUID', 'AZYK.STORE', '1C'],
                    row: statistic
               };

           }
       }
   },
    statisticRAM: async(parent, args, {user}) => {
        if(user.role==='admin') {
            let totalmem = os.totalmem()
            let freemem = os.freemem()
            let usemem = totalmem - freemem
            totalmem = totalmem/1024/1024/1024
            totalmem = Math.round(totalmem * 10)/10
            freemem = freemem/1024/1024/1024
            freemem = Math.round(freemem * 10)/10
            usemem = usemem/1024/1024/1024
            usemem = Math.round(usemem * 10)/10
            return [`${totalmem}GB`, `${usemem}GB`, `${freemem}GB`]
       }
   }
};

module.exports.query = query;
module.exports.resolvers = resolvers;