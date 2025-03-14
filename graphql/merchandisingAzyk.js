const MerchandisingAzyk = require('../models/merchandisingAzyk');
const ClientAzyk = require('../models/clientAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const mongoose = require('mongoose');
const {saveBase64ToFile, urlMain, deleteFile, reductionSearch} = require('../module/const');
const {sendWebPush} = require('../module/webPush');
const EmploymentAzyk = require('../models/employmentAzyk');

const type = `
  type Merchandising {
      _id: ID
      date: Date
      type: String
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
    addMerchandising(organization: ID!, type: String!, geo: String, client: ID!, productAvailability: [String]!, productInventory: Boolean!, productConditions: Int!, productLocation: Int!, images: [Upload]!, fhos: [InputFho]!, needFho: Boolean!, stateProduct: Int!, comment: String!): Data
    checkMerchandising(_id: ID!, reviewerScore: Int, reviewerComment: String): Data
    deleteMerchandising(_id: [ID]!): Data
`;

const resolvers = {
    merchandisings: async(parent, {organization, agent, search, date, client, sort, filter, skip}, {user}) => {
        if(['admin', 'суперагент', 'суперорганизация', 'организация', 'менеджер', 'агент', 'мерчендайзер'].includes(user.role)){
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
                        {name: {'$regex': reductionSearch(search), '$options': 'i'}},
                        {address: {$elemMatch: {$elemMatch: {'$regex': reductionSearch(search), '$options': 'i'}}}}
                    ]
                }).distinct('_id').lean()
            }
            return await MerchandisingAzyk.find({
                ...client?{client: client}:{},
                ...agent?{employment: agent}:{},
                organization: user.organization?user.organization:organization==='super'?null:organization,
                ...filter?
                    filter==='обработка'?{check: false}:{type: filter}
                    :{},
                $and: [
                    {...['суперагент', 'агент'].includes(user.role) && clients.length||user.role==='менеджер'?{client: {$in: clients}}:['суперагент', 'агент', 'мерчендайзер'].includes(user.role)?{employment: user.employment}:{}},
                    {...search.length>0?{client: {$in: _clients}}:{}},
                    ...(!date||date===''?[]:[{date: {$gte: dateStart}}, {date: {$lt:dateEnd}}]),
                ]
            })
                .select('_id client type employment date stateProduct check fhos')
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
        },{
            name: 'Холодные полки',
            value: 'холодные полки'
        },{
            name: 'Теплые полки',
            value: 'теплые полки'
        }]
        return filter
    }
};

const resolversMutation = {
    addMerchandising: async(parent, {organization, type, client, geo, productAvailability, productInventory, productConditions, productLocation, images, fhos, needFho, stateProduct, comment}, {user}) => {
        if(['admin', 'суперагент', 'суперорганизация', 'организация', 'менеджер', 'агент', 'мерчендайзер'].includes(user.role)){
            let _object = new MerchandisingAzyk({
                organization: user.organization?user.organization:organization==='super'?null:organization,
                employment: user.employment?user.employment:null,
                client: user.client?user.client:client,
                date: new Date(),
                type,
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
                _object.images.push(urlMain + await saveBase64ToFile(images[i]))
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
            try{
                const clientName = ((await ClientAzyk.findById(object.client)).address)[0][2]
                const employmentUser = (await EmploymentAzyk.findById(object.employment)).user
                sendWebPush({
                    title: 'Мерчендайзинг',
                    message: `${clientName}\nОценка: ${reviewerScore}${reviewerComment?`\nКомментарий: ${reviewerComment}`:''}`,
                    user: employmentUser,
                    url: `https://azyk.store/merchandising/${_id}`
                })
            } catch (err) {/**/}
        }
        return {data: 'OK'}
    },
    deleteMerchandising: async(parent, { _id }, {user}) => {
        if(['admin', 'суперагент', 'суперорганизация', 'организация', 'менеджер', 'агент', 'мерчендайзер'].includes(user.role)){
            let merchandisings = await MerchandisingAzyk.find({...user.organization?{organization: user.organization}:{}, _id: {$in: _id}}).select('images').lean()
            for(let i=0; i<merchandisings.length; i++) {
                for(let i1=0; i1<merchandisings[i].images.length; i1++) {
                    await deleteFile(merchandisings[i].images[i1])
                }
            }
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