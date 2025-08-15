const AutoAzyk = require('../models/autoAzyk');
const EmploymentAzyk = require('../models/employmentAzyk');
const {reductionSearchText} = require('../module/const');

const type = `
  type Auto {
    _id: ID
    number: String
    tonnage: Float
    employment: Employment
    organization: Organization
    createdAt: Date
 }
`;

const query = `
    autos(organization: ID!, search: String!, sort: String!): [Auto]
    auto(_id: ID!): Auto
    autoByEcspeditor(_id: ID!): Auto
`;

const mutation = `
    addAuto(number: String!, tonnage: Float!, employment: ID, organization: ID): Auto
    setAuto(_id: ID!, number: String, tonnage: Float, employment: ID): String
    deleteAuto(_id: ID!): String
`;

const resolvers = {
    autos: async(parent, {organization, search, sort}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'агент', 'admin'].includes(user.role)) {
            let searchedEmployments;
            if(search) {
                searchedEmployments = await EmploymentAzyk.find({
                    name: {$regex: reductionSearchText(search), $options: 'i'}
               }).distinct('_id')
           }
            return await AutoAzyk.find({
                    organization: user.organization?user.organization:organization==='super'?null:organization,
                    ...search ? {
                            $or: [
                                {number: {$regex: reductionSearchText(search), $options: 'i'}},
                                {employment: {$in: searchedEmployments}},
                            ]
                       }
                        : {}
               })
                    .populate({
                        path: 'employment',
                        select: 'name _id'
                   })
                    .sort(sort)
                    .lean()
       }
   },
    auto: async(parent, {_id}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'агент', 'admin'].includes(user.role)) {
            return await AutoAzyk.findOne({
                $or: [{_id}, {employment: _id}],
                ...user.organization ? {organization: user.organization} : {},
           })
                .populate({
                    path: 'employment',
                    select: 'name _id'
               })
                .populate({
                    path: 'organization',
                    select: 'name _id'
               })
                .lean()
       }
   }
};

const resolversMutation = {
    addAuto: async(parent, {number, tonnage, organization, employment}, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)) {
            // eslint-disable-next-line no-undef
            let [createdObject, employmentData] = await Promise.all([
                AutoAzyk.create({
                    number,
                    tonnage: Math.round(tonnage),
                    organization: user.organization?user.organization:organization==='super'?null:organization,
                    employment
               }),
                employment?EmploymentAzyk.findById(employment).select('_id name').lean():null
            ]);
            return {...createdObject.toObject(), employment: employmentData}
       }
   },
    setAuto: async(parent, {_id, number, tonnage, employment}, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)) {
            let object = await AutoAzyk.findById(_id)
            if(number)object.number = number
            if(tonnage)object.tonnage = tonnage
            if(employment)object.employment = employment
            await object.save();
            return 'OK'
       }
   },
    deleteAuto: async(parent, {_id}, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)) {
            await AutoAzyk.deleteOne({_id, ...user.organization?{organization: user.organization}:{}})
            return 'OK'
       }
   }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;