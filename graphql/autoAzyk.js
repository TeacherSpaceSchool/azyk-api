const AutoAzyk = require('../models/autoAzyk');
const EmploymentAzyk = require('../models/employmentAzyk');
const {reductionSearch} = require('../module/const');

const type = `
  type Auto {
    _id: ID
    number: String
    tonnage: Float
    size: Float
    employment: Employment
    organization: Organization
    createdAt: Date
  }
`;

const query = `
    autos(organization: ID!, search: String!, sort: String!): [Auto]
    auto(_id: ID!): Auto
    autoByEcspeditor(_id: ID!): Auto
    sortAuto: [Sort]
    filterAuto: [Filter]
`;

const mutation = `
    addAuto(number: String!, tonnage: Float!, size: Float!, employment: ID, organization: ID): Auto
    setAuto(_id: ID!, number: String, tonnage: Float, size: Float, employment: ID): Data
    deleteAuto(_id: [ID]!): Data
`;

const resolvers = {
    autos: async(parent, {organization, search, sort}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'агент', 'admin'].includes(user.role)){
            let _employments;
            if(search.length>0){
                _employments = await EmploymentAzyk.find({
                    name: {'$regex': reductionSearch(search), '$options': 'i'}
                }).distinct('_id').lean()
            }

                let autos = await AutoAzyk.find({
                    organization: user.organization?user.organization:organization==='super'?null:organization,
                    ...(search.length>0?{
                            $or: [
                                {number: {'$regex': reductionSearch(search), '$options': 'i'}},
                                {employment: {$in: _employments}},
                            ]
                        }
                        :{})
                })
                    .populate({
                        path: 'employment',
                        select: 'name _id'
                    })
                    .sort(sort)
                    .lean()
                return autos
        }
    },
    auto: async(parent, {_id}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'агент', 'admin'].includes(user.role)) {
            return await AutoAzyk.findOne({
                $or: [{_id: _id}, {employment: _id}],
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
    },
    sortAuto: async() => {
        return [
            {
                name: 'Тоннаж',
                field: 'tonnage'
            },
            {
                name: 'Кубатура',
                field: 'size'
            },
        ]
    },
};

const resolversMutation = {
    addAuto: async(parent, {number, tonnage, size, organization, employment}, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)){
            let _object = new AutoAzyk({
                number: number,
                tonnage: Math.round(tonnage),
                size: Math.round(size),
                organization: user.organization?user.organization:organization==='super'?null:organization,
                employment: employment
            });
            _object = await AutoAzyk.create(_object)
            return _object
        }
    },
    setAuto: async(parent, {_id, number, tonnage, size, employment}, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)) {
            let object = await AutoAzyk.findById(_id)
            if(number)object.number = number
            if(tonnage)object.tonnage = tonnage
            if(size)object.size = size
            if(employment)object.employment = employment
            await object.save();
        }
        return {data: 'OK'}
    },
    deleteAuto: async(parent, { _id }, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)){
            await AutoAzyk.deleteMany({
                _id: {$in: _id},
                ...user.organization?{organization: user.organization}:{}
            })
        }
        return {data: 'OK'}
    }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;