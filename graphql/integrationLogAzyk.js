const IntegrationLogAzyk = require('../models/integrationLogAzyk');
const {isNotEmpty} = require('../module/const');

const type = `
  type IntegrationLog {
    _id: ID
    createdAt: Date
    xml: String
    path: String
 }
`;

const query = `
    integrationLogs(filter: String, organization: ID!, skip: Int!): [IntegrationLog]
`;

const resolvers = {
    integrationLogs: async(parent, {filter, organization, skip}, {user}) => {
        if(user.role==='admin') {
            return await IntegrationLogAzyk.find({...filter?{path: filter}:{}, organization})
                .sort('-createdAt')
                .skip(isNotEmpty(skip)?skip:0)
                .limit(isNotEmpty(skip)?15:10000000000)
                .lean()
       }
   }
};

module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;