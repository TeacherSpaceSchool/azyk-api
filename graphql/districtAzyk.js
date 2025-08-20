const DistrictAzyk = require('../models/districtAzyk');
const mongoose = require('mongoose');
const ClientAzyk = require('../models/clientAzyk');
const AgentRouteAzyk = require('../models/agentRouteAzyk');
const EmploymentAzyk = require('../models/employmentAzyk');
const SubBrandAzyk = require('../models/subBrandAzyk');
const {unawaited, reductionSearchText} = require('../module/const');
const Integrate1CAzyk = require('../models/integrate1CAzyk');
const OrganizationAzyk = require('../models/organizationAzyk');
const SingleOutXMLAdsAzyk = require('../models/singleOutXMLAdsAzyk');
const {addHistory, historyTypes} = require('../module/history');
const {roleList} = require('../module/enum');

const type = `
  type District {
      _id: ID
      createdAt: Date
      organization: Organization
      client: [Client]
      name: String
      agent: Employment
      ecspeditor: Employment
      manager: Employment
      warehouse: Warehouse
 }
`;

const query = `
    districts(organization: ID, search: String!, sort: String!): [District]
    district(_id: ID): District
    clientDistrict(organization: ID!): District
    clientsWithoutDistrict(organization: ID, district: ID, city: String): [Client]
`;

const mutation = `
    addDistrict(organization: ID, client: [ID]!, name: String!, agent: ID, manager: ID, ecspeditor: ID, warehouse: ID, city: String): String
    setDistrict(_id: ID!, client: [ID], name: String, agent: ID, manager: ID, ecspeditor: ID, warehouse: ID): String
    deleteDistrict(_id: ID!): String
`;

const resolvers = {
    districts: async(parent, {organization, search}, {user}) => {
        if([roleList.superOrganization, roleList.organization, roleList.admin, roleList.manager, roleList.agent, roleList.superAgent].includes(user.role)) {
            // eslint-disable-next-line no-undef
            const [searchedClients, searchedEmployments] = await Promise.all([
                search?ClientAzyk.find({
                        $or: [
                            {name: {$regex: reductionSearchText(search), $options: 'i'}},
                            {info: {$regex: reductionSearchText(search), $options: 'i'}},
                            {address: {$elemMatch: {$elemMatch: {$regex: reductionSearchText(search), $options: 'i'}}}}
                        ]
                   }).distinct('_id'):null,
                search?await EmploymentAzyk.find({
                    name: {$regex: reductionSearchText(search), $options: 'i'},
                    ...user.organization?{organization: user.organization}:{}
               }).distinct('_id'):null
            ])
            return await DistrictAzyk.find({
                organization: user.organization || (organization==='super'?null:organization),
                ...(search ? {
                    $or: [
                        {name: {$regex: reductionSearchText(search), $options: 'i'}},
                        {agent: {$in: searchedEmployments}},
                        {ecspeditor: {$in: searchedEmployments}},
                        {manager: {$in: searchedEmployments}},
                        {client: {$in: searchedClients}},
                    ]
               } : {}),
                ...roleList.manager === user.role ? {manager: user.employment} : {},
                ...roleList.agent === user.role ? {agent: user.employment} : {},
           })
                .populate({
                    path: 'agent',
                    select: 'name _id'
               })
                .populate({
                    path: 'ecspeditor',
                    select: 'name _id'
               })
                .populate({
                    path: 'organization',
                    select: 'name _id'
               })
                .populate({
                    path: 'manager',
                    select: 'name _id'
               })
                .sort('name')
                .lean()
       }
   },
    clientsWithoutDistrict: async(parent, {organization, district}, {user}) => {
        if([roleList.admin, roleList.superOrganization, roleList.organization, roleList.manager, roleList.agent, roleList.superAgent].includes(user.role)) {
            if(user.organization) organization = user.organization
            organization = await OrganizationAzyk.findById(organization).select('_id cities clientDuplicate onlyIntegrate').lean()
            // eslint-disable-next-line no-undef
            const [usedClients, integrateClients] = await Promise.all([
                !organization.clientDuplicate||district?DistrictAzyk.find({
                    organization: organization._id,
                    ...organization.clientDuplicate?{_id: district}:{}
               }).distinct('client'):null,
                organization.onlyIntegrate?Integrate1CAzyk
                    .find({
                        client: {$ne: null},
                        organization: organization._id
                   })
                    .distinct('client'):null,
            ])
            let clients = await ClientAzyk.find({
                ...usedClients||integrateClients?{$and: [
                        ...usedClients?[{_id: {$nin: usedClients}}]:[],
                        ...integrateClients?[{_id: {$in: integrateClients}}]:[{}],
                    ]}:{},
                city: organization.cities[0],
                del: {$ne: 'deleted'},
            }).lean()
            return clients

       }
   },
    district: async(parent, {_id}, {user}) => {
        if([roleList.superOrganization, roleList.organization, roleList.admin, roleList.manager, roleList.agent, roleList.superAgent].includes(user.role)) {
            return await DistrictAzyk.findOne({
                ...mongoose.Types.ObjectId.isValid(_id)?{_id}:{},
                ...user.organization?{organization: user.organization}:{},
                ...roleList.manager===user.role?{manager: user.employment}:{},
                ...[roleList.agent, roleList.superAgent].includes(user.role)?{agent: user.employment}:{},
           })
                .populate({
                    path: 'agent',
                    select: 'name _id'
               })
                .populate({
                    path: 'client',
                    select: '_id image createdAt name address lastActive device notification city phone user category',
                    populate: [{path: 'user', select: 'status'}]
                })
                .populate({
                    path: 'ecspeditor',
                    select: 'name _id'
               })
                .populate({
                    path: 'organization',
                    select: 'name _id cities'
               })
                .populate({
                    path: 'manager',
                    select: 'name _id'
               })
                .populate({
                    path: 'warehouse',
                    select: 'name _id'
               })
                .lean()
       }
   },
    //район клиента
    clientDistrict: async(parent, {organization}, {user}) => {
        if(user.role===roleList.client) {
            let subBrand = await SubBrandAzyk.findById(organization).select('organization').lean()
            if(subBrand) organization = subBrand.organization
            return await DistrictAzyk.findOne({
                client: user.client,
                organization
           })
                .select('organization agent manager ecspeditor')
                .populate({
                    path: 'agent',
                    select: 'name phone'
               })
                .populate({
                    path: 'manager',
                    select: 'name phone'
               })
                .populate({
                    path: 'ecspeditor',
                    select: 'name phone'
               })
                .lean()
       }
   }
};

const resolversMutation = {
    addDistrict: async(parent, {organization, client, name, agent, ecspeditor, manager, warehouse}, {user}) => {
        if([roleList.admin, roleList.superOrganization, roleList.organization].includes(user.role)) {
            const createdObject = await DistrictAzyk.create({
                name,
                client,
                agent,
                ecspeditor,
                warehouse,
                organization: user.organization||(organization!=='super'?organization:null),
                manager,
           })
            unawaited(() => addHistory({user, type: historyTypes.create, model: 'DistrictAzyk', name, object: createdObject._id}))
            return createdObject._id;
        }
   },
    setDistrict: async(parent, {_id, client, ecspeditor, name, agent, manager, warehouse}, {user}) => {
        if([roleList.admin, roleList.superOrganization, roleList.organization, roleList.manager, roleList.agent, roleList.superAgent].includes(user.role)) {
            let object = await DistrictAzyk.findOne({_id, ...user.organization?{organization: user.organization}:{}})
            unawaited(() => addHistory({user, type: historyTypes.set, model: 'DistrictAzyk', name: object.name, object: _id, data: {client: `${object.client.length}->${client.length}`, ecspeditor, name, agent, manager, warehouse}}))
            if(name) object.name = name
            if(client) {
                // Приводим старых клиентов преобразуем в строку
                let oldClientsSet = object.client.map(client => client.toString());
                // Приводим новых клиентов
                let newClientsSet = client.map(client => client.toString());
                // Получаем список клиентов, которых нужно удалить из маршрутов (те кто есть в старом списке, но нет в новом)
                let clientsToRemove = oldClientsSet.filter(client => !newClientsSet.includes(client));
                if(clientsToRemove.length) {
                    let agentRouteAzyk = await AgentRouteAzyk.findOne({district: object._id})
                    if (agentRouteAzyk) {
                        let changed = false
                        // Проходим по всем дням недели (индекс 0-6)
                        for(let i = 0; i < 7; i++) {
                            // Проверяем есть ли клиенты на удаление в каждом дне
                            if(agentRouteAzyk.clients[i].some(client => clientsToRemove.includes(client.toString()))) {
                                // Очищаем таких клиентов
                                agentRouteAzyk.clients[i] = agentRouteAzyk.clients[i].filter(client => !clientsToRemove.includes(client.toString()));
                                changed = true;
                           }
                       }
                        // Если были изменения — сохраняем
                        if (changed) {
                            agentRouteAzyk.markModified('clients');
                            await agentRouteAzyk.save()
                       }
                   }
               }
                object.client = client
                object.markModified('client');
           }
            if(warehouse) object.warehouse = warehouse
            if(agent) object.agent = agent
            if(ecspeditor) object.ecspeditor = ecspeditor
            if(manager) object.manager = manager
            await object.save();
       }
        return 'OK'
   },
    deleteDistrict: async(parent, {_id}, {user}) => {
        if([roleList.admin, roleList.superOrganization, roleList.organization].includes(user.role)) {
            const district = await DistrictAzyk.findOne({_id, ...user.organization?{organization: user.organization}:{}}).select('name').lean()
            // eslint-disable-next-line no-undef
            await Promise.all([
                DistrictAzyk.deleteOne({_id, ...user.organization?{organization: user.organization}:{}}),
                AgentRouteAzyk.deleteMany({district: _id, ...user.organization?{organization: user.organization}:{}}),
                SingleOutXMLAdsAzyk.deleteMany({district: _id}),
            ])
            unawaited(() => addHistory({user, type: historyTypes.delete, model: 'DistrictAzyk', name: district.name, object: _id}))
       }

        return 'OK'
   }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;