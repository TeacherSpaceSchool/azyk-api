const PlanClient = require('../models/planClientAzyk');
const ClientAzyk = require('../models/clientAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const InvoiceAzyk = require('../models/invoiceAzyk');
const {saveFile, deleteFile, checkInt, urlMain, reductionSearch} = require('../module/const');
const path = require('path');
const readXlsxFile = require('read-excel-file/node');
const Integrate1CAzyk = require('../models/integrate1CAzyk');
const app = require('../app');
const ExcelJS = require('exceljs');
const randomstring = require('randomstring');
const fs = require('fs');
const OrganizationAzyk = require('../models/organizationAzyk');

const type = `
  type PlanClient {
    _id: ID
    createdAt: Date
    client: Client
    current: Int
    month: Int
    visit: Int
  }
`;

const query = `
    clientsForPlanClients(search: String!, organization: ID!, city: String, district: ID): [Client]
    unloadPlanClients(city: String, organization: ID!, district: ID): Data
    planClients(search: String!, city: String, organization: ID!, district: ID, skip: Int!): [PlanClient]
    planClientsCount(search: String!, city: String, organization: ID!, district: ID): Int
    planClient(client: ID!, organization: ID!): PlanClient
`;

const mutation = `
    setPlanClient(client: ID!, organization: ID!, month: Int!, visit: Int!): Data
    deletePlanClient(_id: ID!): Data
    uploadPlanClients(document: Upload!, organization: ID!): Data
`;

const resolvers = {
    clientsForPlanClients: async(parent, {search, district, organization, city}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'агент', 'admin'].includes(user.role)) {
            let districtClients;
            if(district||['менеджер', 'агент'].includes(user.role)) {
                districtClients = await DistrictAzyk.find({
                    ...district?{_id: district}:{},
                    ...user.role==='агент'?{agent: user.employment}:{},
                    ...user.role==='менеджер'?{manager: user.employment}:{},
                })
                    .distinct('client')
                    .lean()
            }
            let usedClients = await PlanClient.find({
                organization: user.organization?user.organization:organization
            })
                .distinct('client')
                .lean();
            let cities = []
            if(!city) {
                cities = (await OrganizationAzyk.findById(organization).select('cities').lean()).cities
            }
            return await ClientAzyk.find({
                $and: [
                    {_id: {$nin: usedClients}},
                    {del: {$ne: 'deleted'}},
                    ...city?[{city}]:[{city: {$in: cities}}],
                    ...districtClients?[{_id: {$in: districtClients}}]:[],
                    ...search?[{$or: [
                            {name: {'$regex': reductionSearch(search), '$options': 'i'}},
                            {info: {'$regex': reductionSearch(search), '$options': 'i'}},
                            {address: {$elemMatch: {$elemMatch: {'$regex': reductionSearch(search), '$options': 'i'}}}}
                        ]}]:[]
                ]
            })
                .sort('-name')
                .limit(100)
                .lean()
        }
    },
    unloadPlanClients: async(parent, {city, organization, district}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin'].includes(user.role)) {
            let workbook = new ExcelJS.Workbook();
            const worksheet = await workbook.addWorksheet('Планы клиентов');
            let row = 1;
            worksheet.getColumn(1).width = 25;
            worksheet.getColumn(2).width = 15;
            worksheet.getColumn(3).width = 15;
            worksheet.getColumn(4).width = 15;
            worksheet.getColumn(5).width = 15;
            worksheet.getCell(`A${row}`).font = {bold: true};
            worksheet.getCell(`A${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
            worksheet.getCell(`A${row}`).value = 'Клиент:';
            worksheet.getCell(`B${row}`).font = {bold: true};
            worksheet.getCell(`B${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
            worksheet.getCell(`B${row}`).value = 'Посещение:';
            worksheet.getCell(`C${row}`).font = {bold: true};
            worksheet.getCell(`C${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
            worksheet.getCell(`C${row}`).value = 'Месяц:';
            worksheet.getCell(`D${row}`).font = {bold: true};
            worksheet.getCell(`D${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
            worksheet.getCell(`D${row}`).value = 'Прогресс:';
            worksheet.getCell(`E${row}`).font = {bold: true};
            worksheet.getCell(`E${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
            worksheet.getCell(`E${row}`).value = 'GUID:';


            let districtClients;
            if(district||['менеджер', 'агент'].includes(user.role)) {
                districtClients = await DistrictAzyk.find({
                    ...district?{_id: district}:{},
                    ...user.role==='агент'?{agent: user.employment}:{},
                    ...user.role==='менеджер'?{manager: user.employment}:{},
                })
                    .distinct('client')
                    .lean()
            }
            let searchedClients;
            if(city) {
                searchedClients = await ClientAzyk.find({
                    del: {$ne: 'deleted'},
                    ...city?{city}:{}
                })
                    .distinct('_id').lean()
            }
            const res = await PlanClient.find({
                $and: [
                    ...searchedClients?[{client: {$in: searchedClients}}]:[],
                    ...districtClients?[{client: {$in: districtClients}}]:[],
                    {organization: user.organization?user.organization:organization}
                ]
            })
                .sort('-createdAt')
                .populate({
                    path: 'client',
                    select: '_id name address'
                })
                .lean()
            const dateStart = new Date()
            dateStart.setHours(3, 0, 0, 0)
            dateStart.setDate(1)
            const dateEnd = new Date(dateStart)
            dateEnd.setMonth(dateEnd.getMonth() + 1)
            for(let i=0; i<res.length; i++) {
                const invoices = await InvoiceAzyk.find(
                    {
                        $and: [
                            dateStart ? {createdAt: {$gte: dateStart}} : {},
                            dateEnd ? {createdAt: {$lt: dateEnd}} : {}
                        ],
                        taken: true,
                        del: {$ne: 'deleted'},
                        ...city?{city: city}:{},
                        organization: user.organization?user.organization:organization,
                        client: res[i].client._id
                    }
                )
                    .select('allPrice returnedPrice')
                    .lean()
                res[i].current = 0
                for(let i1=0; i1<invoices.length; i1++) {
                    res[i].current += invoices[i1].allPrice - invoices[i1].returnedPrice
                }

                row += 1
                worksheet.getCell(`A${row}`).value = `${res[i].client.name}${res[i].client.address&&res[i].client.address[0]?` (${res[i].client.address[0][2] ? `${res[i].client.address[0][2]}, ` : ''}${res[i].client.address[0][0]})`:''}`;
                worksheet.getCell(`B${row}`).value = res[i].visit;
                worksheet.getCell(`C${row}`).value = res[i].month;
                worksheet.getCell(`D${row}`).value = res[i].current;

                const guid = await Integrate1CAzyk.findOne({
                    organization,
                    client: res[i].client._id
                }).select('guid').lean()
                worksheet.getCell(`E${row}`).value = guid?guid.guid:'';

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
    planClients: async(parent, {search, district, city, organization, skip}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'агент', 'admin'].includes(user.role)) {
            let districtClients;
            if(district||['менеджер', 'агент'].includes(user.role)) {
                districtClients = await DistrictAzyk.find({
                    ...district?{_id: district}:{},
                    ...user.role==='агент'?{agent: user.employment}:{},
                    ...user.role==='менеджер'?{manager: user.employment}:{},
                })
                    .distinct('client')
                    .lean()
            }
            let searchedClients;
            if(search||city) {
                searchedClients = await ClientAzyk.find({
                    del: {$ne: 'deleted'},
                    ...city?{city}:{},
                    ...search?{$or: [
                            {name: {'$regex': reductionSearch(search), '$options': 'i'}},
                            {info: {'$regex': reductionSearch(search), '$options': 'i'}},
                            {address: {$elemMatch: {$elemMatch: {'$regex': reductionSearch(search), '$options': 'i'}}}}
                        ]}:{}
                })
                    .distinct('_id').lean()
            }
            const res = await PlanClient.find({
                $and: [
                    ...searchedClients?[{client: {$in: searchedClients}}]:[],
                    ...districtClients?[{client: {$in: districtClients}}]:[],
                    {organization: user.organization?user.organization:organization}
                ]
            })
                .sort('-createdAt')
                .skip(skip)
                .limit(15)
                .populate({
                    path: 'client',
                    select: '_id name address'
                })
                .lean()
            const dateStart = new Date()
            dateStart.setHours(3, 0, 0, 0)
            dateStart.setDate(1)
            const dateEnd = new Date(dateStart)
            dateEnd.setMonth(dateEnd.getMonth() + 1)
            for(let i=0; i<res.length; i++) {
                const invoices = await InvoiceAzyk.find(
                    {
                        $and: [
                            dateStart ? {createdAt: {$gte: dateStart}} : {},
                            dateEnd ? {createdAt: {$lt: dateEnd}} : {}
                        ],
                        taken: true,
                        del: {$ne: 'deleted'},
                        ...city?{city: city}:{},
                        organization: user.organization?user.organization:organization,
                        client: res[i].client._id
                    }
                )
                    .select('allPrice returnedPrice')
                    .lean()
                res[i].current = 0
                for(let i1=0; i1<invoices.length; i1++) {
                    res[i].current += invoices[i1].allPrice - invoices[i1].returnedPrice
                }
            }
            return res
        }
    },
    planClientsCount: async(parent, {search, district, city, organization}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'агент', 'admin'].includes(user.role)) {
            let districtClients;
            if(district||['менеджер', 'агент'].includes(user.role)) {
                districtClients = await DistrictAzyk.find({
                    ...district?{_id: district}:{},
                    ...user.role==='агент'?{agent: user.employment}:{},
                    ...user.role==='менеджер'?{manager: user.employment}:{},
                })
                    .distinct('client')
                    .lean()
            }
            let searchedClients;
            if(search||city) {
                searchedClients = await ClientAzyk.find({
                    del: {$ne: 'deleted'},
                    ...city?{city}:{},
                    ...search?{$or: [
                            {name: {'$regex': reductionSearch(search), '$options': 'i'}},
                            {info: {'$regex': reductionSearch(search), '$options': 'i'}},
                            {address: {$elemMatch: {$elemMatch: {'$regex': reductionSearch(search), '$options': 'i'}}}}
                        ]}:{}
                })
                    .distinct('_id').lean()
            }
            return await PlanClient.countDocuments({
                $and: [
                    ...searchedClients?[{client: {$in: searchedClients}}]:[],
                    ...districtClients?[{client: {$in: districtClients}}]:[],
                    {organization: user.organization?user.organization:organization}
                ]
            })
                .lean()
        }
    },
    planClient: async(parent, {client, organization}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'агент', 'admin'].includes(user.role)) {
            const res = await PlanClient.findOne({
                client,
                organization: user.organization?user.organization:organization
            }).lean()
            if(res) {
                const dateStart = new Date()
                dateStart.setHours(3, 0, 0, 0)
                dateStart.setDate(1)
                const dateEnd = new Date(dateStart)
                dateEnd.setMonth(dateEnd.getMonth() + 1)
                const invoices = await InvoiceAzyk.find(
                    {
                        $and: [
                            dateStart ? {createdAt: {$gte: dateStart}} : {},
                            dateEnd ? {createdAt: {$lt: dateEnd}} : {}
                        ],
                        taken: true,
                        del: {$ne: 'deleted'},
                        organization: user.organization ? user.organization : organization,
                        client
                    }
                )
                    .select('allPrice returnedPrice')
                    .lean()
                res.current = 0
                for (let i1 = 0; i1 < invoices.length; i1++) {
                    res.current += invoices[i1].allPrice - invoices[i1].returnedPrice
                }
            }
            return res
        }
    }
};

const resolversMutation = {
    setPlanClient: async(parent, {client, organization, month, visit}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'агент', 'admin'].includes(user.role)){
            let planClient = await PlanClient.findOne({
                client,
                organization: user.organization?user.organization:organization
            });
            if(!planClient){
                planClient = new PlanClient({
                    month, visit,
                    client,
                    organization: user.organization?user.organization:organization
                });
                planClient = await PlanClient.create(planClient)
            }
            else {
                planClient.month = month;
                planClient.visit = visit;
                await planClient.save();
            }
            return {data: 'OK'};
        }
    },
    deletePlanClient: async(parent, {_id}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'агент', 'admin'].includes(user.role)){
             await PlanClient.deleteOne({
                _id,
                ...user.organization? {organization: user.organization}:{}
            });
        }
        return {data: 'OK'};
    },
    uploadPlanClients: async(parent, { document, organization }, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'агент', 'admin'].includes(user.role)){
            let {stream, filename} = await document;
            filename = await saveFile(stream, filename);
            let xlsxpath = path.join(app.dirname, 'public', filename);
            let rows = await readXlsxFile(xlsxpath)
            if(user.organization) organization = user.organization
            for (let i = 0; i < rows.length; i++) {
                const visit = checkInt(rows[i][1])
                const month = checkInt(rows[i][2])
                let client = (await Integrate1CAzyk.findOne({
                    organization,
                    guid: rows[i][0]
                }).select('client').lean()).client
                let planClient = await PlanClient.findOne({
                    organization,
                    client
                })
                if(!planClient){
                    let _object = new PlanClient({
                        month, visit,
                        client,
                        organization: user.organization?user.organization:organization
                    });
                    await PlanClient.create(_object)
                }
                else {
                    planClient.month = month;
                    planClient.visit = visit;
                    await planClient.save();
                }

            }
            await deleteFile(filename)
            return ({data: 'OK'})
        }
    },
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;