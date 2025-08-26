const EquipmentAzyk = require('../models/equipmentAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const ExcelJS = require('exceljs');
const randomstring = require('randomstring');
const path = require('path');
const fs = require('fs');
const {urlMain, saveImage, reductionSearch, isNotEmpty, defaultLimit, reductionSearchText} = require('../module/const');
const app = require('../app');
const ClientAzyk = require('../models/clientAzyk');
const EmploymentAzyk = require('../models/employmentAzyk');
const OrganizationAzyk = require('../models/organizationAzyk');

const type = `
  type Equipment {
    _id: ID
    createdAt: Date
    image: String
    number: String
    model: String
    client: Client
    agentsHistory: [AgentHistoryEquipment]
    agent: Employment
    organization: Organization
 }
  type AgentHistoryEquipment {
       date: Date
       agent: Employment
 }
`;

const query = `
    equipments(organization: ID!, search: String!, agent: ID, skip: Int): [Equipment]
    equipmentsCount(organization: ID!, search: String!, agent: ID): String
    unloadEquipments(organization: ID!): String
`;

const mutation = `
    addEquipment(number: String!, model: String!, client: ID, agent: ID, organization: ID): Equipment
    setEquipment(_id: ID!, image: Upload, number: String, model: String, client: ID, agent: ID): String
    deleteEquipment(_id: ID!): String
`;

const resolvers = {
    unloadEquipments: async(parent, {organization}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin'].includes(user.role)) {
            let workbook = new ExcelJS.Workbook();
            const worksheet = await workbook.addWorksheet('Оборудование');
            let row = 1;
            worksheet.getColumn(1).width = 25;
            worksheet.getColumn(2).width = 15;
            worksheet.getColumn(3).width = 15;
            worksheet.getColumn(4).width = 15;
            worksheet.getColumn(5).width = 15;
            worksheet.getCell(`A${row}`).font = {bold: true};
            worksheet.getCell(`A${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
            worksheet.getCell(`A${row}`).value = 'Номер:';
            worksheet.getCell(`B${row}`).font = {bold: true};
            worksheet.getCell(`B${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
            worksheet.getCell(`B${row}`).value = 'Модель:';
            worksheet.getCell(`C${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
            worksheet.getCell(`C${row}`).font = {bold: true};
            worksheet.getCell(`C${row}`).value = 'Клиент:';
            worksheet.getCell(`D${row}`).border = {top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
            worksheet.getCell(`D${row}`).value = 'Агент:';
            worksheet.getCell(`D${row}`).font = {bold: true};

            const res = await EquipmentAzyk.find({organization: user.organization||organization})
                .sort('-createdAt')
                .populate({
                    path: 'client',
                    select: 'name _id address'
               })
                .populate({
                    path: 'agent',
                    select: '_id name'
               })
                .lean()
            for(let i=0; i<res.length; i++) {
                row += 1
                worksheet.getCell(`A${row}`).value = res[i].number;
                worksheet.getCell(`B${row}`).value = res[i].model;
                if(res[i].client)
                    worksheet.getCell(`C${row}`).value = `${res[i].client.name}${res[i].client.address&&res[i].client.address[0]?` (${res[i].client.address[0][2] ? `${res[i].client.address[0][2]}, ` : ''}${res[i].client.address[0][0]})`:''}`;
                if(res[i].agent)
                    worksheet.getCell(`D${row}`).value = res[i].agent.name;
           }
            let xlsxname = `${randomstring.generate(20)}.xlsx`;
            let xlsxdir = path.join(app.dirname, 'public', 'xlsx');
            if (!fs.existsSync(xlsxdir)) {
                await fs.mkdirSync(xlsxdir);
           }
            let xlsxpath = path.join(app.dirname, 'public', 'xlsx', xlsxname);
            await workbook.xlsx.writeFile(xlsxpath);
            return urlMain + '/xlsx/' + xlsxname
       }
   },
    equipments: async(parent, {organization, search, agent, skip}, {user}) => {
        if(['admin', 'суперорганизация', 'организация', 'менеджер', 'агент', 'ремонтник'].includes(user.role)) {
            // eslint-disable-next-line no-undef
            const [districtClients, searchedClients] = await Promise.all([
                ['агент', 'менеджер'].includes(user.role)?DistrictAzyk.find({agent: user.employment}).distinct('client'):null,
                search?ClientAzyk.find({
                    del: {$ne: 'deleted'},
                    ...search?{$or: [
                            {name: {$regex: reductionSearchText(search), $options: 'i'}},
                            {info: {$regex: reductionSearchText(search), $options: 'i'}},
                            {address: {$elemMatch: {$elemMatch: {$regex: reductionSearchText(search), $options: 'i'}}}}
                        ]}:{}
               }).distinct('_id'):null
            ])
            let equipments = await EquipmentAzyk.find({
                $and: [
                    {organization: user.organization||(organization==='super'?null:organization)},
                    ...agent?[{agent}]:[],
                    ...districtClients?[
                        {
                            $or: [
                                {client: {$in: districtClients}},
                                {agent: user.employment}
                            ]
                       }
                    ]:[],
                    ...search?[
                        {
                            $or: [
                                {number: {$regex: reductionSearch(search), $options: 'i'}},
                                {client: {$in: searchedClients}}
                            ]
                       }
                    ]:[],
                ]
           })
                .skip(isNotEmpty(skip)?skip:0)
                .limit(isNotEmpty(skip)?defaultLimit:10000000000)
                .populate({
                    path: 'client',
                    select: 'name _id address'
               })
                .populate({
                    path: 'agent',
                    select: '_id name'
               })
                .populate({
                    path: 'agentsHistory.agent',
                    select: '_id name'
               })
                .populate({
                    path: 'organization',
                    select: '_id name'
               })
                .sort('-createdAt')
                .lean()
            return equipments
       }
   },
    equipmentsCount: async(parent, {organization, search, agent}, {user}) => {
        if(['admin', 'суперорганизация', 'организация', 'менеджер', 'агент', 'ремонтник'].includes(user.role)) {
            // eslint-disable-next-line no-undef
            const [districtClients, searchedClients] = await Promise.all([
                ['агент', 'менеджер'].includes(user.role)?DistrictAzyk.find({agent: user.employment}).distinct('client'):null,
                search?ClientAzyk.find({
                    del: {$ne: 'deleted'},
                    ...search?{$or: [
                            {name: {$regex: reductionSearchText(search), $options: 'i'}},
                            {info: {$regex: reductionSearchText(search), $options: 'i'}},
                            {address: {$elemMatch: {$elemMatch: {$regex: reductionSearchText(search), $options: 'i'}}}}
                        ]}:{}
               }).distinct('_id'):null
            ])
            return await EquipmentAzyk.countDocuments({
                $and: [
                    {organization: user.organization || (organization === 'super' ? null : organization)},
                    ...agent ? [{agent}] : [],
                    ...districtClients ? [
                        {
                            $or: [
                                {client: {$in: districtClients}},
                                {agent: user.employment}
                            ]
                        }
                    ] : [],
                    ...search ? [
                        {
                            $or: [
                                {number: {$regex: reductionSearch(search), $options: 'i'}},
                                {client: {$in: searchedClients}}
                            ]
                        }
                    ] : [],
                ]
            })
       }
   }
};

const resolversMutation = {
    addEquipment: async(parent, {number, model, client, agent, organization}, {user}) => {
        if(['агент', 'admin', 'суперагент', 'суперорганизация', 'организация', 'ремонтник'].includes(user.role)) {
            if(['агент', 'суперагент'].includes(user.role)) agent = user.employment
            // eslint-disable-next-line no-undef
            const [createdObject, agentData, organizationData, clientData] = await Promise.all([
                EquipmentAzyk.create({
                    number,
                    model,
                    client,
                    agent,
                    agentsHistory: agent?[{agent, date: new Date()}]:[],
                    organization
               }),
                agent?EmploymentAzyk.findById(agent).select('_id name').lean():null,
                organization?OrganizationAzyk.findById(organization).select('_id name').lean():null,
                client?ClientAzyk.findById(client).select('_id name address').lean():null
            ]);
            return {...createdObject.toObject(), ...agentData?{agent: agentData, agentsHistory: [{agent: agentData, date: new Date()}]}:{}, client: clientData, organization: organizationData}
       }
   },
    setEquipment: async(parent, {_id, image, number, model, client, agent}, {user}) => {
        if(['агент', 'admin', 'суперагент', 'суперорганизация', 'организация', 'ремонтник'].includes(user.role)) {
            let object = await EquipmentAzyk.findById(_id)
            if(client) object.client = client
            if(number) object.number = number
            if(model) object.model = model
            if(agent) {
                object.agent = agent
                object.agentsHistory = [...object.agentsHistory, {agent, date: new Date()}]
           }
            if (image) {
                let {stream, filename} = await image;
                object.image = urlMain + await saveImage(stream, filename)
           }
            await object.save();
       }
        return 'OK'
   },
    deleteEquipment: async(parent, {_id}, {user}) => {
        if(['агент', 'admin', 'суперагент', 'суперорганизация', 'организация', 'ремонтник'].includes(user.role)) {
            await EquipmentAzyk.deleteOne({_id, ...user.organization?{organization: user.organization}:{}})
       }
        return 'OK'
   },
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;