const IntegrationLogAzyk = require('../models/integrationLogAzyk');
const {isNotEmpty, defaultLimit} = require('../module/const');
const {roleList} = require('../module/enum');

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
        if(user.role===roleList.admin) {
            return await IntegrationLogAzyk.find({...filter?{path: filter}:{}, organization})
                .sort('-createdAt')
                .skip(isNotEmpty(skip)?skip:0)
                .limit(isNotEmpty(skip)?defaultLimit:10000000000)
                .lean()
       }
   }
};

module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;