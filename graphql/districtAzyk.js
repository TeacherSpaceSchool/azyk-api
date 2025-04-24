const DistrictAzyk = require('../models/districtAzyk');
const OrganizationAzyk = require('../models/organizationAzyk');
const mongoose = require('mongoose');
const ClientAzyk = require('../models/clientAzyk');
const ItemAzyk = require('../models/itemAzyk');
const OrderAzyk = require('../models/orderAzyk');
const AgentRouteAzyk = require('../models/agentRouteAzyk');
const EmploymentAzyk = require('../models/employmentAzyk');
const UserAzyk = require('../models/userAzyk');
const OutXMLAdsShoroAzyk = require('../models/integrate/shoro/outXMLAdsShoroAzyk');
const SubBrandAzyk = require('../models/subBrandAzyk');
const {reductionSearch} = require('../module/const');

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
  }
`;

const query = `
    districts(organization: ID, search: String!, sort: String!): [District]
    district(_id: ID): District
    clientDistrict(organization: ID!): District
    sortDistrict: [Sort]
    clientsWithoutDistrict(organization: ID, district: ID, city: String): [Client]
`;

const mutation = `
    addDistrict(organization: ID, client: [ID]!, name: String!, agent: ID, manager: ID, ecspeditor: ID, city: String): Data
    setDistrict(_id: ID!, client: [ID], name: String, agent: ID, manager: ID, ecspeditor: ID): Data
    deleteDistrict(_id: [ID]!): Data
`;

const resolvers = {
    districts: async(parent, {organization, search, sort}, {user}) => {
        if(['суперорганизация', 'организация', 'admin', 'менеджер', 'агент', 'суперагент'].includes(user.role)) {
            let _organizations;
            let _clients;
            let _agents;
            if (search.length > 0) {
                _clients = await ClientAzyk
                    .find({
                        $or: [
                            {name: {'$regex': reductionSearch(search), '$options': 'i'}},
                            {address: {$elemMatch: {$elemMatch: {'$regex': reductionSearch(search), '$options': 'i'}}}}
                        ]
                    })
                    .distinct('_id')
                    .lean()
                _agents = await EmploymentAzyk.find({
                    name: {'$regex': reductionSearch(search), '$options': 'i'}
                }).distinct('_id').lean()
                _organizations = await OrganizationAzyk.find({
                    name: {'$regex': reductionSearch(search), '$options': 'i'}
                }).distinct('_id').lean()
            }
            return await DistrictAzyk.find({
                organization: user.organization?user.organization: organization === 'super' ? null : organization,
                ...(search.length > 0 ? {
                    $or: [
                        {name: {'$regex': reductionSearch(search), '$options': 'i'}},
                        {agent: {$in: _agents}},
                        {ecspeditor: {$in: _agents}},
                        {manager: {$in: _agents}},
                        {client: {$in: _clients}},
                        {organization: {$in: _organizations}}
                    ]
                } : {}),
                ...'менеджер' === user.role ? {manager: user.employment} : {},
                ...'агент' === user.role ? {agent: user.employment} : {},
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
    clientsWithoutDistrict: async(parent, { organization, city, district }, {user}) => {
        if(['admin', 'суперорганизация', 'организация', 'менеджер', 'агент', 'суперагент'].includes(user.role)){
            if(organization!=='super')
                 organization = await OrganizationAzyk.findOne({_id: organization}).select('_id accessToClient clientDuplicate').lean()
            let usedClients
            if(!organization.clientDuplicate||district) {
                usedClients = await DistrictAzyk.find({
                    organization: user.organization ? user.organization : organization._id,
                    ...organization.clientDuplicate ? {_id: district} : {}
                }).distinct('client').lean()
            }
            let clients
            if(!organization.accessToClient) {
                let items = await ItemAzyk.find({organization: user.organization}).distinct('_id').lean()
                clients = await OrderAzyk.find({item: {$in: items}}).distinct('client').lean()
            }
            clients = await ClientAzyk
                .aggregate(
                    [
                        {
                            $match: {
                                $and: [
                                    ...usedClients?[{_id: { $nin: usedClients}}]:[],
                                    ...clients?[{_id: {$in: clients}}]:[],
                                    {name: {'$regex': '^((?!агент).)*$', '$options': 'i'}},
                                    {name: {'$regex': '^((?!agent).)*$', '$options': 'i'}}
                                ],
                                ...user.cities?{city: {$in: user.cities}}:{},
                                ...city ? {city: city} : {},
                                del: {$ne: 'deleted'},
                                address: {$elemMatch: {$elemMatch: {$ne: ''}}},
                            }
                        },
                        {
                            $lookup:
                                {
                                    from: UserAzyk.collection.collectionName,
                                    let: {user: '$user'},
                                    pipeline: [
                                        {$match: {$expr: {$eq: ['$$user', '$_id']}}},
                                    ],
                                    as: 'user'
                                }
                        },
                        {
                            $unwind: {
                                preserveNullAndEmptyArrays: true, // this remove the object which is null
                                path: '$user'
                            }
                        },
                        {
                            $match: {
                                'user.status': 'active'
                            }
                        },
                    ])
            return clients

        }
    },
    district: async(parent, {_id}, {user}) => {
        if(['суперорганизация', 'организация', 'admin', 'менеджер', 'агент', 'суперагент'].includes(user.role)) {
            return await DistrictAzyk.findOne({
                ...mongoose.Types.ObjectId.isValid(_id)?{_id: _id}:{},
                ...user.organization?{organization: user.organization}:{},
                ...'менеджер'===user.role?{manager: user.employment}:{},
                ...['агент', 'суперагент'].includes(user.role)?{agent: user.employment}:{},
            })
                .populate({
                    path: 'agent',
                    select: 'name _id'
                })
                .populate({path: 'client', select: '_id image createdAt name address lastActive device notification city phone user category', populate: [{path: 'user', select: 'status'}]})
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
                .lean()
        }
    },
    clientDistrict: async(parent, {organization}, {user}) => {
        if('client'===user.role) {
            let subBrand = await SubBrandAzyk.findOne({_id: organization}).select('organization').lean()
            if(subBrand) organization = subBrand.organization
            const res = await DistrictAzyk.findOne({
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
            return res
        }
    },
    sortDistrict: async() => {
        let sort = [
            {
                name: 'Имя',
                field: 'name'
            }
        ]
        return sort
    },
};

const resolversMutation = {
    addDistrict: async(parent, {organization, client, name, agent, ecspeditor, manager}, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)){
            let _object = new DistrictAzyk({
                name: name,
                client: client,
                agent: agent,
                ecspeditor: ecspeditor,
                organization: user.organization?user.organization:organization!=='super'?organization:undefined,
                manager: manager,
            });
            await DistrictAzyk.create(_object)
        }
        return {data: 'OK'};
    },
    setDistrict: async(parent, {_id, client, ecspeditor, name, agent, manager}, {user}) => {
        let object = await DistrictAzyk.findById(_id)
        if(object&&['admin', 'суперорганизация', 'организация', 'менеджер', 'агент', 'суперагент'].includes(user.role)){
            if(name)object.name = name
            if(client){
                let objectAgentRouteAzyk = await AgentRouteAzyk.findOne({district: object._id})
                if(objectAgentRouteAzyk){
                    for(let i=0; i<object.client.length; i++) {
                        if(!client.includes(object.client[i].toString())){
                            for(let i2=0; i2<7; i2++) {
                                let index = objectAgentRouteAzyk.clients[i2].indexOf(object.client[i].toString())
                                if(index!==-1)
                                    objectAgentRouteAzyk.clients[i2].splice(index, 1)
                            }
                            await objectAgentRouteAzyk.save()
                        }
                    }
                }
                object.client = client
                object.markModified('client');
            }
            if(agent)object.agent = agent
            if(ecspeditor)object.ecspeditor = ecspeditor
            if(manager)object.manager = manager
            await object.save();
        }
        return {data: 'OK'}
    },
    deleteDistrict: async(parent, { _id }, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)) {
            let objects = await DistrictAzyk.find({
                _id: {$in: _id},
                ...user.organization?{organization: user.organization}:{}
            }).select('_id').lean()
            for(let i=0; i<objects.length; i++){
                await DistrictAzyk.deleteMany({_id: objects[i]._id})
                await AgentRouteAzyk.deleteMany({district: objects[i]._id})
                await OutXMLAdsShoroAzyk.deleteMany({district: objects[i]._id})
            }
        }

        return {data: 'OK'}
    }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;