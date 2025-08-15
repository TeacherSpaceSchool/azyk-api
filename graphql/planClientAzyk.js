const PlanClient = require('../models/planClientAzyk');
const ClientAzyk = require('../models/clientAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const InvoiceAzyk = require('../models/invoiceAzyk');
const {
    saveFile, deleteFile, checkInt, urlMain, isNotEmpty, dayStartDefault, defaultLimit, reductionSearchText
} = require('../module/const');
const path = require('path');
const readXlsxFile = require('read-excel-file/node');
const Integrate1CAzyk = require('../models/integrate1CAzyk');
const app = require('../app');
const ExcelJS = require('exceljs');
const randomstring = require('randomstring');
const fs = require('fs');
const OrganizationAzyk = require('../models/organizationAzyk');
const {parallelBulkWrite, parallelPromise} = require('../module/parallel');

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
    unloadPlanClients(city: String, organization: ID!, district: ID): String
    planClients(search: String!, city: String, organization: ID!, district: ID, skip: Int!): [PlanClient]
    planClientsCount(search: String!, city: String, organization: ID!, district: ID): Int
    planClient(client: ID!, organization: ID!): PlanClient
`;

const mutation = `
    setPlanClient(client: ID!, organization: ID!, month: Int!, visit: Int!): ID
    deletePlanClient(_id: ID!): String
    uploadPlanClients(document: Upload!, organization: ID!): String
`;

const resolvers = {
    clientsForPlanClients: async(parent, {search, district, organization, city}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'агент', 'admin'].includes(user.role)) {

            // eslint-disable-next-line no-undef
            const [districtClients, usedClients, organizationCities] = await Promise.all([
                district||['менеджер', 'агент'].includes(user.role)?DistrictAzyk.find({
                    ...district?{_id: district}:{},
                    ...user.role==='агент'?{agent: user.employment}:{},
                    ...user.role==='менеджер'?{manager: user.employment}:{},
               }).distinct('client'):null,
                PlanClient.find({organization: user.organization||organization}).distinct('client'),
                !city?OrganizationAzyk.findById(organization).select('cities').lean():null
            ])

            let cities = []
            if(!city) {
                cities = organizationCities.cities
           }

            return await ClientAzyk.find({
                $and: [
                    {_id: {$nin: usedClients}},
                    {del: {$ne: 'deleted'}},
                    ...city?[{city}]:[{city: {$in: cities}}],
                    ...districtClients?[{_id: {$in: districtClients}}]:[],
                    ...search?[{$or: [
                            {name: {$regex: reductionSearchText(search), $options: 'i'}},
                            {info: {$regex: reductionSearchText(search), $options: 'i'}},
                            {address: {$elemMatch: {$elemMatch: {$regex: reductionSearchText(search), $options: 'i'}}}}
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

            // eslint-disable-next-line no-undef
            const [districtClients, searchedClients] = await Promise.all([
                district||['менеджер', 'агент'].includes(user.role)?DistrictAzyk.find({
                    ...district?{_id: district}:{},
                    ...user.role==='агент'?{agent: user.employment}:{},
                    ...user.role==='менеджер'?{manager: user.employment}:{},
               }).distinct('client'):null,
                city?ClientAzyk.find({
                    del: {$ne: 'deleted'},
                    ...city?{city}:{}
               }).distinct('_id'):null
            ])

            const res = await PlanClient.find({
                $and: [
                    ...searchedClients?[{client: {$in: searchedClients}}]:[],
                    ...districtClients?[{client: {$in: districtClients}}]:[],
                    {organization: user.organization||organization}
                ]
           })
                .sort('-createdAt')
                .populate({
                    path: 'client',
                    select: '_id name address'
               })
                .lean()
            const dateStart = new Date()
            dateStart.setHours(dayStartDefault, 0, 0, 0)
            dateStart.setDate(1)
            const dateEnd = new Date(dateStart)
            dateEnd.setMonth(dateEnd.getMonth() + 1)
            await parallelPromise(res, async resData => {
                // eslint-disable-next-line no-undef
                const [invoices, integrateData] = await Promise.all([
                    InvoiceAzyk.find(
                    {
                        createdAt: {$gte: dateStart, $lt: dateEnd},
                        taken: true,
                        del: {$ne: 'deleted'},
                        ...city?{city}:{},
                        organization: user.organization||organization,
                        client: resData.client._id
                   }
                )
                    .select('allPrice returnedPrice')
                    .lean(),
                    Integrate1CAzyk.findOne({organization, client: resData.client._id}).select('guid').lean()
                ])

                resData.current = 0
                for(let i1=0; i1<invoices.length; i1++) {
                    resData.current += invoices[i1].allPrice - invoices[i1].returnedPrice
               }

                row += 1
                worksheet.getCell(`A${row}`).value = `${resData.client.name}${resData.client.address&&resData.client.address[0]?` (${resData.client.address[0][2] ? `${resData.client.address[0][2]}, ` : ''}${resData.client.address[0][0]})`:''}`;
                worksheet.getCell(`B${row}`).value = resData.visit;
                worksheet.getCell(`C${row}`).value = resData.month;
                worksheet.getCell(`D${row}`).value = resData.current;

                worksheet.getCell(`E${row}`).value = integrateData?integrateData.guid:'';

           })
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
    planClients: async(parent, {search, district, city, organization, skip}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'агент', 'admin'].includes(user.role)) {

            // eslint-disable-next-line no-undef
            const [districtClients, searchedClients] = await Promise.all([
                district||['менеджер', 'агент'].includes(user.role)?DistrictAzyk.find({
                    ...district?{_id: district}:{},
                    ...user.role==='агент'?{agent: user.employment}:{},
                    ...user.role==='менеджер'?{manager: user.employment}:{},
               }).distinct('client'):null,
                !search||city?ClientAzyk.find({
                    del: {$ne: 'deleted'},
                    ...city?{city}:{},
                    ...search?{$or: [
                            {name: {$regex: reductionSearchText(search), $options: 'i'}},
                            {info: {$regex: reductionSearchText(search), $options: 'i'}},
                            {address: {$elemMatch: {$elemMatch: {$regex: reductionSearchText(search), $options: 'i'}}}}
                        ]}:{}
               })
                    .distinct('_id'):null
            ])

            const res = await PlanClient.find({
                $and: [
                    ...searchedClients?[{client: {$in: searchedClients}}]:[],
                    ...districtClients?[{client: {$in: districtClients}}]:[],
                    {organization: user.organization||organization}
                ]
           })
                .sort('-createdAt')
                .skip(isNotEmpty(skip)?skip:0)
                .limit(isNotEmpty(skip)?defaultLimit:10000000000)
                .populate({
                    path: 'client',
                    select: '_id name address'
               })
                .lean()
            const dateStart = new Date()
            dateStart.setHours(dayStartDefault, 0, 0, 0)
            dateStart.setDate(1)
            const dateEnd = new Date(dateStart)
            dateEnd.setMonth(dateEnd.getMonth() + 1)
            // eslint-disable-next-line no-undef
            await parallelPromise(res, async resData => {
                const invoices = await InvoiceAzyk.find(
                    {
                        createdAt: {$gte: dateStart, $lt: dateEnd},
                        taken: true,
                        del: {$ne: 'deleted'},
                        ...city?{city}:{},
                        organization: user.organization||organization,
                        client: resData.client._id
                   }
                )
                    .select('allPrice returnedPrice')
                    .lean()
                resData.current = 0
                for(let i1=0; i1<invoices.length; i1++) {
                    resData.current += invoices[i1].allPrice - invoices[i1].returnedPrice
               }
           })
            return res
       }
   },
    planClientsCount: async(parent, {search, district, city, organization}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'агент', 'admin'].includes(user.role)) {
            // eslint-disable-next-line no-undef
            const [districtClients, searchedClients] = await Promise.all([
                district||['менеджер', 'агент'].includes(user.role)?DistrictAzyk.find({
                    ...district?{_id: district}:{},
                    ...user.role==='агент'?{agent: user.employment}:{},
                    ...user.role==='менеджер'?{manager: user.employment}:{},
               }).distinct('client'):null,
                !search||city?ClientAzyk.find({
                    del: {$ne: 'deleted'},
                    ...city?{city}:{},
                    ...search?{$or: [
                            {name: {$regex: reductionSearchText(search), $options: 'i'}},
                            {info: {$regex: reductionSearchText(search), $options: 'i'}},
                            {address: {$elemMatch: {$elemMatch: {$regex: reductionSearchText(search), $options: 'i'}}}}
                        ]}:{}
               })
                    .distinct('_id'):null
            ])
            return await PlanClient.countDocuments({
                $and: [
                    ...searchedClients?[{client: {$in: searchedClients}}]:[],
                    ...districtClients?[{client: {$in: districtClients}}]:[],
                    {organization: user.organization||organization}
                ]
           })
                .lean()
       }
   },
    planClient: async(parent, {client, organization}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'агент', 'admin'].includes(user.role)) {
            const res = await PlanClient.findOne({
                client,
                organization: user.organization||organization
           }).lean()
            if(res) {
                const dateStart = new Date()
                dateStart.setHours(dayStartDefault, 0, 0, 0)
                dateStart.setDate(1)
                const dateEnd = new Date(dateStart)
                dateEnd.setMonth(dateEnd.getMonth() + 1)
                const invoices = await InvoiceAzyk.find(
                    {
                        createdAt: {$gte: dateStart, $lt: dateEnd},
                        taken: true,
                        del: {$ne: 'deleted'},
                        organization: user.organization||organization,
                        client
                   }
                )
                    .select('allPrice returnedPrice')
                    .lean()
                res.current = 0
                for(let i1 = 0; i1 < invoices.length; i1++) {
                    res.current += invoices[i1].allPrice - invoices[i1].returnedPrice
               }
           }
            return res
       }
   }
};

const resolversMutation = {
    setPlanClient: async(parent, {client, organization, month, visit}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin'].includes(user.role)) {
            organization = user.organization||organization
            let planClient = await PlanClient.findOne({client, organization});
            if(!planClient)
                planClient = await PlanClient.create({month, visit, client, organization})
            else {
                planClient.month = month;
                planClient.visit = visit;
                await planClient.save();
           }
            return planClient._id;
       }
   },
    deletePlanClient: async(parent, {_id}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin'].includes(user.role)) {
             await PlanClient.deleteOne({
                _id,
                ...user.organization? {organization: user.organization}:{}
           });
       }
        return 'OK';
   },
    uploadPlanClients: async(parent, {document, organization}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin'].includes(user.role)) {
            let {stream, filename} = await document;
            let xlsxpath = path.join(app.dirname, 'public', await saveFile(stream, filename));
            let rows = await readXlsxFile(xlsxpath)
            if(user.organization) organization = user.organization
            //получаем интеграции
            const integrates = await Integrate1CAzyk.find({
                organization, client: {$ne: null},
                guid: {$in: rows.map(row => row[0])}
           }).select('client guid').lean()
            const clientByGuid = {}
            for(const integrate of integrates) {
                clientByGuid[integrate.guid] = integrate.client.toString()
           }
            //planByClient
            const planClients = await PlanClient.find({
                organization,
                client: {$in: Object.values(clientByGuid)}
           }).select('_id client')
            const planByClient = {}
            for(const planClient of planClients) {
                planByClient[planClient.client.toString()] = planClient._id
           }
            //bulkwrite
            const bulkOperations = [];
            //перебор
            for(const row of rows) {
                const visit = checkInt(row[1])
                const month = checkInt(row[2])
                let client = clientByGuid[row[0]]
                let planClient = planByClient[client]
                //если нету добавляем
                if (!planClient)
                    bulkOperations.push({insertOne: {month, visit, client, organization}});
                // если есть — подготовим updateOne в bulkWrite
                else
                    bulkOperations.push({updateOne: {filter: {_id: planClient}, update: {$set: {month, visit}}}});
           }
            // если есть обновления — выполним bulkWrite
            if (bulkOperations.length) await parallelBulkWrite(PlanClient, bulkOperations);
            await deleteFile(filename)
            return  'OK'
       }
   },
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;