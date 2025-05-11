const OutXMLShoroAzyk = require('../models/singleOutXMLAzyk');
const OutXMLReturnedShoroAzyk = require('../models/singleOutXMLReturnedAzyk');
const Integrate1CAzyk = require('../models/integrate1CAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const InvoiceAzyk = require('../models/invoiceAzyk');
const ReturnedAzyk = require('../models/returnedAzyk');
const {reductionSearch} = require('../module/const');

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
    filterOutXMLShoro: [Filter]
`;

const mutation = `
    setDateOutXMLShoro(_id: ID!, date: String!): Data
    restoreOutXMLShoro(_id: ID!): OutXMLShoro
    deleteOutXMLShoro(_id: ID!): Data
    deleteOutXMLShoroAll(organization: ID!): Data
    setDateOutXMLReturnedShoro(_id: ID!, date: String!): Data
    restoreOutXMLReturnedShoro(_id: ID!): OutXMLReturnedShoro
    deleteOutXMLReturnedShoro(_id: ID!): Data
    deleteOutXMLReturnedShoroAll(organization: ID!): Data
`;

const resolvers = {
    outXMLShoros: async(parent, {search, filter, skip, organization}, {user}) => {
        if('admin'===user.role){
            let outXMLShoro = await OutXMLShoroAzyk
                .find({
                    status: {'$regex': filter, '$options': 'i'},
                    number: {'$regex': reductionSearch(search), '$options': 'i'},
                    organization: organization
                })
                .sort('-createdAt')
                .skip(skip!=undefined?skip:0)
                .limit(skip!=undefined?15:10000000000)
                .lean()
            return outXMLShoro
        }
        else return []
    },
    statisticOutXMLShoros: async(parent, {organization}, {user}) => {
        if('admin'===user.role){
            let outXMLShoro = await OutXMLShoroAzyk
                .find({organization: organization}).lean()
            let procces = 0;
            let error = 0;
            let check = 0;
            for(let i=0; i<outXMLShoro.length; i++){
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
        if('admin'===user.role){
            let outXMLReturnedShoroAzyk = await OutXMLReturnedShoroAzyk
                .find({organization: organization})
                .select('status')
                .lean()
            let procces = 0;
            let error = 0;
            let check = 0;
            for(let i=0; i<outXMLReturnedShoroAzyk.length; i++){
                if(outXMLReturnedShoroAzyk[i].status==='check')
                    check+=1
                else if(['update', 'create', 'del'].includes(outXMLReturnedShoroAzyk[i].status))
                    procces+=1
                else if(outXMLReturnedShoroAzyk[i].status==='error')
                    error+=1
            }

            return [procces, check, error]
        }
        else return []
    },
    outXMLReturnedShoros: async(parent, {search, filter, skip, organization}, {user}) => {
        if('admin'===user.role){
            let outXMLShoro = await OutXMLReturnedShoroAzyk
                .find({
                    status: {'$regex': filter, '$options': 'i'},
                    number: {'$regex': reductionSearch(search), '$options': 'i'},
                    organization: organization
                })
                .sort('-createdAt')
                .skip(skip!=undefined?skip:0)
                .limit(skip!=undefined?100:10000000000)
            return outXMLShoro
        }
        else return []
    },
    filterOutXMLShoro: async(parent, ctx, {user}) => {
        if('admin'===user.role)
            return [
                {
                    name: 'Все',
                    value: ''
                },
                {
                    name: 'Создан',
                    value: 'create'
                },
                {
                    name: 'Обновлен',
                    value: 'update'
                },
                {
                    name: 'На удаление',
                    value: 'del'
                },
                {
                    name: 'Выполнен',
                    value: 'check'
                },
                {
                    name: 'Ошибка',
                    value: 'error'
                }
            ]
        else return []
    }
};

const resolversMutation = {
    setDateOutXMLShoro: async(parent, {_id, date}, {user}) => {
        if('admin'===user.role){
            let object = await OutXMLShoroAzyk.findById(_id)
            object.date = new Date(date)
            object.status = 'update'
            await object.save();
        }
        return {data: 'OK'}
    },
    restoreOutXMLShoro: async(parent, { _id }, {user}) => {
        if('admin'===user.role){
            let object = await OutXMLShoroAzyk.findById(_id)
            let invoice = await InvoiceAzyk.findOne({_id: object.invoice})
            let guidClient = await Integrate1CAzyk
                .findOne({client: invoice.client, organization: invoice.organization})
            if(guidClient) {
                let district = await DistrictAzyk
                    .findOne({client: invoice.client, organization: invoice.organization})
                if(district) {
                    let guidAgent = await Integrate1CAzyk
                        .findOne({agent: district.agent})
                    let guidEcspeditor = await Integrate1CAzyk
                        .findOne({ecspeditor: district.ecspeditor})
                    if (guidAgent && guidEcspeditor) {
                        invoice.sync = 1
                        await invoice.save()
                        object.client = guidClient.guid
                        object.agent = guidAgent.guid
                        object.forwarder = guidEcspeditor.guid
                        object.status = 'update'
                    }
                }
            }
            await object.save();
            return object
        }
    },
    deleteOutXMLShoro: async(parent, { _id }, {user}) => {
        if('admin'===user.role){
            let object = await OutXMLShoroAzyk.findOne({_id: _id, status: {$ne: 'check'}})
            await InvoiceAzyk.updateOne({_id: object._id}, {sync: 0});
            await OutXMLShoroAzyk.deleteOne({_id: _id})
        }
        return {data: 'OK'}
    },
    deleteOutXMLShoroAll: async(parent, {organization}, {user}) => {
        if('admin'===user.role){
            let objects = await OutXMLShoroAzyk.find({organization: organization, status: {$ne: 'check'}}).distinct('_id')
            await InvoiceAzyk.updateMany({_id: {$in: objects}}, {sync: 0});
            await OutXMLShoroAzyk.deleteMany({status: {$ne: 'check'}})
        }
        return {data: 'OK'}
    },
    setDateOutXMLReturnedShoro: async(parent, {_id, date}, {user}) => {
        if('admin'===user.role){
            let object = await OutXMLReturnedShoroAzyk.findById(_id)
            object.date = new Date(date)
            object.status = 'update'
            await object.save();
        }
        return {data: 'OK'}
    },
    restoreOutXMLReturnedShoro: async(parent, { _id }, {user}) => {
        if('admin'===user.role){
            let object = await OutXMLReturnedShoroAzyk.findById(_id)
            let returned = await ReturnedAzyk.findOne({_id: object.returned})
            let guidClient = await Integrate1CAzyk
                .findOne({client: returned.client, organization: returned.organization})
            if(guidClient) {
                let district = await DistrictAzyk
                    .findOne({client: returned.client, organization: returned.organization})
                if(district) {
                    let guidAgent = await Integrate1CAzyk
                        .findOne({agent: district.agent})
                    let guidEcspeditor = await Integrate1CAzyk
                        .findOne({ecspeditor: district.ecspeditor})
                    if (guidAgent && guidEcspeditor) {
                        returned.sync = 1
                        await returned.save()
                        object.client = guidClient.guid
                        object.agent = guidAgent.guid
                        object.forwarder = guidEcspeditor.guid
                        object.status = 'update'
                    }
                }
            }
            await object.save();
            return object
        }
    },
    deleteOutXMLReturnedShoro: async(parent, { _id }, {user}) => {
        if('admin'===user.role){
            let object = await OutXMLReturnedShoroAzyk.findOne({_id: _id, status: {$ne: 'check'}})
            await ReturnedAzyk.updateOne({_id: object._id}, {sync: 0});
            await OutXMLReturnedShoroAzyk.deleteOne({_id: _id})
        }
        return {data: 'OK'}
    },
    deleteOutXMLReturnedShoroAll: async(parent, {organization}, {user}) => {
        if('admin'===user.role){
            let objects = await OutXMLReturnedShoroAzyk.find({organization: organization, status: {$ne: 'check'}}).distinct('_id')
            await ReturnedAzyk.updateMany({_id: {$in: objects}}, {sync: 0});
            await OutXMLReturnedShoroAzyk.deleteMany({status: {$ne: 'check'}})
        }
        return {data: 'OK'}
    },
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;