const OutXMLAzyk = require('../models/singleOutXMLAzyk');
const OutXMLReturnedAzyk = require('../models/singleOutXMLReturnedAzyk');
const InvoiceAzyk = require('../models/invoiceAzyk');
const ReturnedAzyk = require('../models/returnedAzyk');
const {reductionSearch, isNotEmpty, defaultLimit} = require('../module/const');

const type = `
  type OutXMLShoro{
    _id: ID
    createdAt: Date
    guid: String
    date: Date
    number: String
    client: String
    agent: String
    forwarder: String
    invoice: Invoice
    status: String
    organization: String
    exc: String
 }
  type OutXMLReturnedShoro{
    _id: ID
    createdAt: Date
    guid: String
    date: Date
    number: String
    client: String
    agent: String
     organization: String
   forwarder: String
    returned: Returned
    status: String
    exc: String
 }
`;

const query = `
    outXMLShoros(search: String!, filter: String!, skip: Int, organization: ID!): [OutXMLShoro]
    statisticOutXMLShoros(organization: ID!): [String]
    outXMLReturnedShoros(search: String!, filter: String!, skip: Int, organization: ID!): [OutXMLReturnedShoro]
    statisticOutXMLReturnedShoros(organization: ID!): [String]
`;

const mutation = `
    deleteOutXMLShoro(_id: ID!): String
    deleteOutXMLShoroAll(organization: ID!): String
    deleteOutXMLReturnedShoro(_id: ID!): String
    deleteOutXMLReturnedShoroAll(organization: ID!): String
`;

const resolvers = {
    outXMLShoros: async(parent, {search, filter, skip, organization}, {user}) => {
        if('admin'===user.role) {
            let outXMLShoro = await OutXMLAzyk
                .find({
                    status: {$regex: filter, $options: 'i'},
                    ...search?{$or: [{number: {$regex: reductionSearch(search), $options: 'i'}}, {guid: {$regex: reductionSearch(search), $options: 'i'}},]}:{},
                    organization: organization
               })
                .sort('-createdAt')
                .skip(isNotEmpty(skip)?skip:0)
                .limit(isNotEmpty(skip)?defaultLimit:10000000000)
                .lean()
            return outXMLShoro
       }
        else return []
   },
    statisticOutXMLShoros: async(parent, {organization}, {user}) => {
        if('admin'===user.role) {
            let outXMLShoro = await OutXMLAzyk
                .find({organization}).lean()
            let procces = 0;
            let error = 0;
            let check = 0;
            for(let i=0; i<outXMLShoro.length; i++) {
                if(outXMLShoro[i].status==='check')
                    check+=1
                else if(['update', 'create', 'del'].includes(outXMLShoro[i].status))
                    procces+=1
                else if(outXMLShoro[i].status==='error')
                    error+=1
           }

            return [check, procces, error]
       }
        else return []
   },
    statisticOutXMLReturnedShoros: async(parent, {organization}, {user}) => {
        if('admin'===user.role) {
            let outXMLReturnedAzyk = await OutXMLReturnedAzyk
                .find({organization})
                .select('status')
                .lean()
            let procces = 0;
            let error = 0;
            let check = 0;
            for(let i=0; i<outXMLReturnedAzyk.length; i++) {
                if(outXMLReturnedAzyk[i].status==='check')
                    check+=1
                else if(['update', 'create', 'del'].includes(outXMLReturnedAzyk[i].status))
                    procces+=1
                else if(outXMLReturnedAzyk[i].status==='error')
                    error+=1
           }

            return [check, procces, error]
       }
        else return []
   },
    outXMLReturnedShoros: async(parent, {search, filter, skip, organization}, {user}) => {
        if('admin'===user.role) {
            return await OutXMLReturnedAzyk
                .find({
                    status: {$regex: filter, $options: 'i'},
                    ...search?{$or: [{number: {$regex: reductionSearch(search), $options: 'i'}}, {guid: {$regex: reductionSearch(search), $options: 'i'}},]}:{},
                    organization: organization
               })
                .sort('-createdAt')
                .skip(isNotEmpty(skip) ? skip : 0)
                .limit(isNotEmpty(skip) ? 100 : 10000000000)
       }
        else return []
   }
};

const resolversMutation = {
    deleteOutXMLShoro: async(parent, {_id}, {user}) => {
        if('admin'===user.role) {
            let invoiceId = await OutXMLAzyk.findOne({_id, status: {$ne: 'check'}}).select('invoice').lean()
            // eslint-disable-next-line no-undef
            await Promise.all([
                InvoiceAzyk.updateOne({_id: invoiceId.invoice}, {sync: 0}),
                OutXMLAzyk.deleteOne({_id, status: {$ne: 'check'}})
            ])
       }
        return 'OK'
   },
    deleteOutXMLShoroAll: async(parent, {organization}, {user}) => {
        if('admin'===user.role) {
            let invoiceIds = await OutXMLAzyk.find({organization, status: {$ne: 'check'}}).distinct('invoice')
            // eslint-disable-next-line no-undef
            await Promise.all([
                InvoiceAzyk.updateMany({_id: {$in: invoiceIds}}, {sync: 0}),
                OutXMLAzyk.deleteMany({organization, status: {$ne: 'check'}})
            ])
       }
        return 'OK'
   },
    deleteOutXMLReturnedShoro: async(parent, {_id}, {user}) => {
        if('admin'===user.role) {
            let object = await OutXMLReturnedAzyk.findOne({_id, status: {$ne: 'check'}}).select('returned').lean()
            // eslint-disable-next-line no-undef
            await Promise.all([
                ReturnedAzyk.updateOne({_id: object.returned}, {sync: 0}),
                OutXMLReturnedAzyk.deleteOne({_id, status: {$ne: 'check'}})
            ])
       }
        return 'OK'
   },
    deleteOutXMLReturnedShoroAll: async(parent, {organization}, {user}) => {
        if('admin'===user.role) {
            let returnedIds = await OutXMLReturnedAzyk.find({organization, status: {$ne: 'check'}}).distinct('returned')
            // eslint-disable-next-line no-undef
            await Promise.all([
                ReturnedAzyk.updateMany({_id: {$in: returnedIds}}, {sync: 0}),
                OutXMLReturnedAzyk.deleteMany({organization, status: {$ne: 'check'}})
            ])
       }
        return 'OK'
   },
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;