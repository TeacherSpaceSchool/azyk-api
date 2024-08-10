const RepairEquipmentAzyk = require('../models/repairEquipmentAzyk');
const EmploymentAzyk = require('../models/employmentAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const ClientAzyk = require('../models/clientAzyk');
const randomstring = require('randomstring');

const type = `
  type RepairEquipment {
    _id: ID
    createdAt: Date
    number: String
    status: String
    equipment: String
    client: Client
    repairMan: Employment
    agent: Employment
    organization: Organization
    accept: Boolean
    done: Boolean
    cancel: Boolean
    defect: [String]
    repair: [String]
    dateRepair: Date
  }
`;

const query = `
    repairEquipments(organization: ID!, search: String!, filter: String!): [RepairEquipment]
    repairEquipment(_id: ID!): RepairEquipment
    filterRepairEquipment: [Filter]
`;

const mutation = `
    addRepairEquipment(organization: ID, client: ID!, equipment: String!, defect: [String]!): Data
    setRepairEquipment(_id: ID!, accept: Boolean, done: Boolean, client: ID, equipment: String, cancel: Boolean, defect: [String], repair: [String]): Data
    deleteRepairEquipment(_id: [ID]!): Data
`;

const resolvers = {
    repairEquipments: async(parent, {organization, search, filter}, {user}) => {
        if(['admin', 'суперорганизация', 'организация', 'менеджер', 'агент', 'ремонтник'].includes(user.role)) {
            let clients = []
            if(['агент', 'менеджер'].includes(user.role)){
                clients = await DistrictAzyk
                    .find({agent: user.employment})
                    .distinct('client')
                    .lean()
            }
            let _clients = [];
            let _agents = [];
            if(search.length>0) {
                _clients = await ClientAzyk.find({del: {$ne: 'deleted'}, $or: [{name: {'$regex': search, '$options': 'i'}},{info: {'$regex': search, '$options': 'i'}}, {address: {$elemMatch: {$elemMatch: {'$regex': search, '$options': 'i'}}}}]})
                    .distinct('_id').lean()
                _agents = await EmploymentAzyk.find({
                    name: {'$regex': search, '$options': 'i'}
                }).distinct('_id').lean()
            }
            let repairEquipments = await RepairEquipmentAzyk.find({
                organization: user.organization?user.organization:organization==='super'?null:organization,
                status: {'$regex': filter, '$options': 'i'},
                $and: [
                    {...['агент', 'менеджер'].includes(user.role)?{client: {$in: clients}}:{}},
                    {...(search.length>0?{
                        $or: [
                            {number: {'$regex': search, '$options': 'i'}},
                            {equipment: {'$regex': search, '$options': 'i'}},
                            {client: {$in: _clients}},
                            {agent: {$in: _agents}},
                            {repairMan: {$in: _agents}},
                        ]
                    }
                    :{})}
                ]
            })
                .populate({
                    path: 'client',
                    select: 'name _id address'
                })
                .populate({
                    path: 'agent',
                    select: '_id name'
                })
                .populate({
                    path: 'repairMan',
                    select: '_id name'
                })
                .populate({
                    path: 'organization',
                    select: '_id name'
                })
                .sort('-createdAt')
                .lean()
            return repairEquipments
        }
    },
    repairEquipment: async(parent, {_id}, {user}) => {
        if(['admin', 'суперорганизация', 'организация', 'менеджер', 'агент', 'ремонтник'].includes(user.role)) {
            return await RepairEquipmentAzyk.findOne({
                _id: _id,
                ...user.organization ? {organization: user.organization} : {}
            })
                .populate({
                    path: 'client',
                    select: 'name _id address'
                })
                .populate({
                    path: 'agent',
                    select: '_id name'
                })
                .populate({
                    path: 'repairMan',
                    select: '_id name'
                })
                .populate({
                    path: 'organization',
                    select: '_id name'
                })
                .lean()
        }
    },
    filterRepairEquipment: async() => {
        let filter = [
            {
                name: 'Все',
                value: ''
            },
            {
                name: 'Обработка',
                value: 'обработка'
            },
            {
                name: 'Отмена',
                value: 'отмена'
            },
            {
                name: 'Принят',
                value: 'принят'
            },
            {
                name: 'Выполнен',
                value: 'выполнен'
            }
        ]
        return filter
    },
};

const resolversMutation = {
    addRepairEquipment: async(parent, {equipment, client, defect, organization}, {user}) => {
        if(['агент', 'admin', 'суперагент', 'суперорганизация', 'организация'].includes(user.role)){
            let number = randomstring.generate({length: 12, charset: 'numeric'});
            while (await RepairEquipmentAzyk.findOne({number: number}).select('_id').lean())
                number = randomstring.generate({length: 12, charset: 'numeric'});
            let _object = new RepairEquipmentAzyk({
                number: number,
                status: 'обработка',
                equipment: equipment,
                client,
                agent: user.employment?user.employment:null,
                organization: user.organization?user.organization:organization,
                accept: false,
                done: false,
                cancel: false,
                defect: defect,
                repair: [],
                dateRepair: null,
                repairMan: null
            });
            await RepairEquipmentAzyk.create(_object)
        }
        return {data: 'OK'};
    },
    setRepairEquipment: async(parent, {_id, accept, done, cancel, defect, repair, equipment, client}, {user}) => {
        if(['агент', 'admin', 'суперагент', 'суперорганизация', 'организация', 'ремонтник'].includes(user.role)) {
            let object = await RepairEquipmentAzyk.findById(_id)
            if(user.role==='ремонтник')object.repairMan = user.employment
            if(defect&&!object.accept&&!object.cancel)object.defect = defect
            if(repair&&(object.accept||accept)&&!object.done)object.repair = repair
            if(equipment&&!object.accept&&!object.cancel)object.equipment = equipment
            if(client&&!object.accept&&!object.cancel)object.client = client
            if(accept!==undefined&&!object.cancel){
                object.accept = accept
                object.status = 'принят'
            }
            if(done!==undefined&&object.accept){
                object.done = done
                object.dateRepair = new Date()
                object.status = 'выполнен'
            }
            if(cancel!==undefined&&!object.accept){
                object.cancel = cancel
                object.status = 'отмена'
            }
            await object.save();
        }
        return {data: 'OK'}
    },
    deleteRepairEquipment: async(parent, { _id }, {user}) => {
        if(['агент', 'admin', 'суперагент', 'суперорганизация', 'организация'].includes(user.role)){
            await RepairEquipmentAzyk.deleteMany({_id: {$in: _id}, ...user.organization?{organization: user.organization}:{}})
        }
        return {data: 'OK'}
    },
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;