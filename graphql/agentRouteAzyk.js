const AgentRouteAzyk = require('../models/agentRouteAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const mongoose = require('mongoose');
const {reductionSearch} = require('../module/const');

const type = `
  type AgentRoute {
      _id: ID
      createdAt: Date
      organization: Organization
      clients: [[ID]]
      district: District
 }
`;

const query = `
    agentRoutes(organization: ID, search: String!): [AgentRoute]
    agentRoute(_id: ID!): AgentRoute
    districtsWithoutAgentRoutes(organization: ID): [District]
`;

const mutation = `
    addAgentRoute(organization: ID, clients: [[ID]]!, district: ID): ID
    setAgentRoute(_id: ID!, clients: [[ID]]): String
    deleteAgentRoute(_id: ID!): String
`;

const resolvers = {
    agentRoutes: async(parent, {organization, search}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin' ].includes(user.role)) {
            // eslint-disable-next-line no-undef
            const [searchedDistricts, employmentDistricts] = await Promise.all([
                search?DistrictAzyk.find({name: {$regex: reductionSearch(search), $options: 'i'}}).distinct('_id'):null,
                user.role==='менеджер'?DistrictAzyk.find({manager: user.employment}).distinct('_id'):null
            ])
            organization = user.organization||(organization === 'super'?null:organization)
            return await AgentRouteAzyk
                .find({
                    organization,
                    ...employmentDistricts? {district: {$in: employmentDistricts}} : {},
                    ...(search ? {district: {$in: searchedDistricts}} : {})
               })
                .select('_id createdAt organization district')
                .populate({
                    path: 'district',
                    select: 'name _id'
               })
                .populate({
                    path: 'organization',
                    select: 'name _id'
               })
                .lean()
       }
   },
    districtsWithoutAgentRoutes: async(parent, {organization}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin' ].includes(user.role)) {
            organization = organization==='super'?null:organization
            let districts = await AgentRouteAzyk
                .find({organization})
                .distinct('district')
            districts = await DistrictAzyk
                .find({
                    ...'менеджер' === user.role ? {manager: user.employment} : {},
                    _id: {$nin: districts},
                    organization
               })
                .select('_id createdAt name organization client')
                .populate({path: 'client', select: '_id image createdAt name address lastActive device notification city phone user', populate: [{path: 'user', select: 'status'}]})
                .populate({path: 'organization', select: 'name _id'})
                .sort('-createdAt')
                .lean()
            return districts
       }
   },
    agentRoute: async(parent, {_id}, {user}) => {
        if(['суперорганизация', 'организация', 'агент', 'суперагент', 'менеджер', 'admin', ].includes(user.role)) {
            let employmentDistricts
            if (['агент', 'суперагент', 'менеджер'].includes(user.role)) {
                employmentDistricts = await DistrictAzyk
                    .find('менеджер' === user.role?{manager: user.employment}:{agent: user.employment})
                    .distinct('_id')
                    .lean()
           }
            return await AgentRouteAzyk.findOne({
                ...mongoose.Types.ObjectId.isValid(_id)?{_id}:{},
                ...user.organization ? {organization: user.organization} : {},
                ...employmentDistricts ? {district: {$in: employmentDistricts}} : {}
           })
                .populate({path: 'district', select: 'name _id client', populate: [{path: 'client', select: '_id image createdAt name address lastActive device notification city phone user category', populate: [{path: 'user', select: 'status'}]}]})
                .populate({path: 'organization', select: 'name _id'})
                .lean()
       }
   }
};

const resolversMutation = {
    addAgentRoute: async(parent, {organization, clients, district}, {user}) => {
        if(['admin', 'суперорганизация', 'организация', 'менеджер'].includes(user.role)) {
            const createdObject = await AgentRouteAzyk.create({district, clients, organization: organization!=='super'?organization:null})
            return createdObject._id;
       }
   },
    setAgentRoute: async(parent, {_id, clients}, {user}) => {
        if(['admin', 'суперорганизация', 'организация', 'менеджер', 'агент', 'суперагент'].includes(user.role)) {
            await AgentRouteAzyk.updateOne({_id, ...user.organization?{organization: user.organization}:{}}, {clients})
            return 'OK'
       }
   },
    deleteAgentRoute: async(parent, {_id}, {user}) => {
        if(['admin', 'суперорганизация', 'организация', 'менеджер'].includes(user.role)) {
            await AgentRouteAzyk.deleteOne({_id, ...user.organization ? {organization: user.organization} : {}})
            return 'OK'
       }
   }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;