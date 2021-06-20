const MerchandisingAzyk = require('../models/merchandisingAzyk');
const ClientAzyk = require('../models/clientAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const mongoose = require('mongoose');

const type = `
  type Merchandising {
      _id: ID
      date: Date
      employment: Employment
      organization: Organization
      client: Client
      productAvailability: [String]
      productInventory: Boolean
      productConditions: Int
      productLocation: Int
      images: [String]
      fhos: [Fho]
      needFho: Boolean
      check: Boolean
      stateProduct: Int
      comment: String
      geo: String
      reviewerScore: Int
      reviewerComment: String
  }
  type Fho {
      type: String
      images: [String]
      layout: Int
      state: Int
      foreignProducts: Boolean
      filling: Int
  }
  input InputFho {
      type: String
      images: [Upload]
      layout: Int
      state: Int
      foreignProducts: Boolean
      filling: Int
  }
`;

const query = `
    merchandisings(organization: ID!, agent: ID, client: ID, date: String, search: String!, sort: String!, filter: String!, skip: Int): [Merchandising]
    merchandising(_id: ID!): Merchandising
    sortMerchandising: [Sort]
    filterMerchandising: [Filter]
`;

const mutation = `
    addMerchandising(organization: ID!, geo: String, client: ID!, productAvailability: [String]!, productInventory: Boolean!, productConditions: Int!, productLocation: Int!, images: [Upload]!, fhos: [InputFho]!, needFho: Boolean!, stateProduct: Int!, comment: String!): Data
    checkMerchandising(_id: ID!, reviewerScore: Int, reviewerComment: String): Data
    deleteMerchandising(_id: [ID]!): Data
`;

const resolvers = {
    merchandisings: async(parent, {organization, agent, search, date, client, sort, filter, skip}, {user}) => {
        if(['admin', 'суперагент', 'суперорганизация', 'организация', 'менеджер', 'агент'].includes(user.role)){
            let clients
            let dateStart;
            let dateEnd;
            if(date&&date!==''){
                dateStart = new Date(date)
                dateStart.setHours(0, 0, 0, 0)
                dateEnd = new Date(dateStart)
                dateEnd.setDate(dateEnd.getDate() + 1)
            }
            if (['суперагент', 'агент', 'менеджер'].includes(user.role))
                clients = await DistrictAzyk
                    .find({$or: [{manager: user.employment}, {agent: user.employment}]})
                    .distinct('client')
                    .lean()
            let _clients;
            if (search.length > 0) {
                _clients = await ClientAzyk.find({
                    $or: [
                        {name: {'$regex': search, '$options': 'i'}},
                        {address: {$elemMatch: {$elemMatch: {'$regex': search, '$options': 'i'}}}}
                    ]
                }).distinct('_id').lean()
            }
            return await MerchandisingAzyk.find({
                ...client?{client: client}:{},
                ...agent?{employment: agent}:{},
                organization: user.organization?user.organization:organization==='super'?null:organization,
                ...filter==='обработка'?{check: false}:{},
                $and: [
                    {...['суперагент', 'агент'].includes(user.role) && clients.length||user.role==='менеджер'?{client: {$in: clients}}:['суперагент', 'агент'].includes(user.role)?{employment: user.employment}:{}},
                    {...search.length>0?{client: {$in: _clients}}:{}},
                    ...(!date||date===''?[]:[{date: {$gte: dateStart}}, {date: {$lt:dateEnd}}]),
                ]
            })
                .select('_id client employment date stateProduct check fhos')
                .populate({
                    path: 'client',
                    select: '_id name address'
                })
                .populate({
                    path: 'employment',
                    select: '_id name'
                })
                .sort(sort)
                .skip(skip != undefined ? skip : 0)
                .limit(skip != undefined ? 200 : 10000000000)
                .lean()
        }
    },
    merchandising: async(parent, {_id}, {user}) => {
        if(mongoose.Types.ObjectId.isValid(_id)) {
            return await MerchandisingAzyk.findOne({
                ...user.organization?{organization: user.organization}:{},
                _id: _id
            })
                .populate({
                    path: 'client',
                    select: '_id name address'
                })
                .populate({
                    path: 'employment',
                    select: '_id name'
                })
                .lean()
        } else return null
    },
    sortMerchandising: async() => {
        return [
            {
                name: 'Дата',
                field: 'date'
            },
            {
                name: 'Оценка',
                field: 'stateProduct'
            },
            {
                name: 'Статус',
                field: 'check'
            }
        ]
    },
    filterMerchandising: async() => {
        let filter = [{
            name: 'Все',
            value: ''
        },{
            name: 'Обработка',
            value: 'обработка'
        }]
        return filter
    }
};

const resolversMutation = {
    addMerchandising: async(parent, {organization, client, geo, productAvailability, productInventory, productConditions, productLocation, images, fhos, needFho, stateProduct, comment}, {user}) => {
        if(['admin', 'суперагент', 'суперорганизация', 'организация', 'менеджер', 'агент'].includes(user.role)){
            let _object = new MerchandisingAzyk({
                organization: user.organization?user.organization:organization==='super'?null:organization,
                employment: user.employment?user.employment:null,
                client: user.client?user.client:client,
                date: new Date(),
                productAvailability: productAvailability,
                productInventory: productInventory,
                productConditions: productConditions,
                productLocation: productLocation,
                needFho: needFho,
                stateProduct: stateProduct,
                comment: comment,
                images: [],
                fhos: [],
                geo: geo,
                check: false
            });
            for(let i=0; i<images.length; i++) {
                _object.images.push(images[i])
            }
            for(let i=0; i<fhos.length; i++) {
                _object.fhos.push(fhos[i])
            }
            await MerchandisingAzyk.create(_object)
        }
        return {data: 'OK'};
    },
    checkMerchandising: async(parent, {_id, reviewerScore, reviewerComment}, {user}) => {
        if(['admin', 'суперорганизация', 'организация', 'менеджер'].includes(user.role)){
            let object = await MerchandisingAzyk.findOne({
                _id: _id,
                ...user.organization?{organization: user.organization}:{}
            })
            object.check = true
            object.reviewerScore = reviewerScore
            object.reviewerComment = reviewerComment
            await object.save();
        }
        return {data: 'OK'}
    },
    deleteMerchandising: async(parent, { _id }, {user}) => {
        if(['admin', 'суперагент', 'суперорганизация', 'организация', 'менеджер', 'агент'].includes(user.role)){
             await MerchandisingAzyk.deleteMany({
                ...user.organization?{organization: user.organization}:{},
                _id: {$in: _id}
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