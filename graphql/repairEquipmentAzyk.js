const RepairEquipmentAzyk = require('../models/repairEquipmentAzyk');
const EmploymentAzyk = require('../models/employmentAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const ClientAzyk = require('../models/clientAzyk');
const randomstring = require('randomstring');
const {reductionSearch, isNotEmpty, reductionSearchText} = require('../module/const');

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
`;

const mutation = `
    addRepairEquipment(organization: ID, client: ID!, equipment: String!, defect: [String]!): ID
    setRepairEquipment(_id: ID!, accept: Boolean, done: Boolean, client: ID, equipment: String, cancel: Boolean, defect: [String], repair: [String]): String
    deleteRepairEquipment(_id: ID!): String
`;

const resolvers = {
    repairEquipments: async(parent, {organization, search, filter}, {user}) => {
        if(['admin', 'суперорганизация', 'организация', 'менеджер', 'агент', 'ремонтник'].includes(user.role)) {
            // eslint-disable-next-line no-undef
            const [employmentClients, searchedAgents, searchedClients] = await Promise.all([
                ['агент', 'менеджер'].includes(user.role)?DistrictAzyk.find({agent: user.employment}).distinct('client'):null,
                search?EmploymentAzyk.find({name: {$regex: reductionSearchText(search), $options: 'i'}}).distinct('_id'):null,
                search?ClientAzyk.find({$or: [
                        {name: {$regex: reductionSearchText(search), $options: 'i'}},
                        {info: {$regex: reductionSearchText(search), $options: 'i'}},
                        {address: {$elemMatch: {$elemMatch: {$regex: reductionSearchText(search), $options: 'i'}}}}
                    ]}).distinct('_id'):null
            ])
            return await RepairEquipmentAzyk.find({
                organization: user.organization || (organization==='super'?null:organization),
                ...filter?{status: {$regex: filter, $options: 'i'}}:{},
                ...employmentClients ? {client: {$in: employmentClients}} : {},
                ...search ? {
                    $or: [
                        {number: {$regex: reductionSearch(search), $options: 'i'}},
                        {equipment: {$regex: reductionSearch(search), $options: 'i'}},
                        {client: {$in: searchedClients}},
                        {agent: {$in: searchedAgents}},
                        {repairMan: {$in: searchedAgents}}
                    ]
               } : {}
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
       }
   },
    repairEquipment: async(parent, {_id}, {user}) => {
        if(['admin', 'суперорганизация', 'организация', 'менеджер', 'агент', 'ремонтник'].includes(user.role)) {
            return await RepairEquipmentAzyk.findOne({
                _id,
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
   }
};

const resolversMutation = {
    addRepairEquipment: async(parent, {equipment, client, defect, organization}, {user}) => {
        if(['агент', 'admin', 'суперагент', 'суперорганизация', 'организация'].includes(user.role)) {
            let number = randomstring.generate({length: 12, charset: 'numeric'});
            while (await RepairEquipmentAzyk.findOne({number: number}).select('_id').lean())
                number = randomstring.generate({length: 12, charset: 'numeric'});
            const createdObject = await RepairEquipmentAzyk.create({
                number: number,
                status: 'обработка',
                equipment: equipment,
                client,
                agent: user.employment?user.employment:null,
                organization: user.organization||organization,
                accept: false,
                done: false,
                cancel: false,
                defect: defect,
                repair: [],
                dateRepair: null,
                repairMan: null
           })
            return createdObject._id;
       }
   },
    setRepairEquipment: async(parent, {_id, accept, done, cancel, defect, repair, equipment, client}, {user}) => {
        if(['агент', 'admin', 'суперагент', 'суперорганизация', 'организация', 'ремонтник'].includes(user.role)) {
            let object = await RepairEquipmentAzyk.findById(_id)
            if(user.role==='ремонтник')object.repairMan = user.employment
            if(defect&&!object.accept&&!object.cancel)object.defect = defect
            if(repair&&(object.accept||accept)&&!object.done)object.repair = repair
            if(equipment&&!object.accept&&!object.cancel)object.equipment = equipment
            if(client&&!object.accept&&!object.cancel)object.client = client
            if(isNotEmpty(accept)&&!object.cancel) {
                object.accept = accept
                object.status = 'принят'
           }
            if(isNotEmpty(done)&&object.accept) {
                object.done = done
                object.dateRepair = new Date()
                object.status = 'выполнен'
           }
            if(isNotEmpty(cancel)&&!object.accept) {
                object.cancel = cancel
                object.status = 'отмена'
           }
            await object.save();
       }
        return 'OK'
   },
    deleteRepairEquipment: async(parent, {_id}, {user}) => {
        if(['агент', 'admin', 'суперагент', 'суперорганизация', 'организация'].includes(user.role)) {
            await RepairEquipmentAzyk.deleteOne({_id, ...user.organization?{organization: user.organization}:{}})
       }
        return 'OK'
   },
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;