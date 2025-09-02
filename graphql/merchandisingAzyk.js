const MerchandisingAzyk = require('../models/merchandisingAzyk');
const ClientAzyk = require('../models/clientAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const mongoose = require('mongoose');
const {saveBase64ToFile, urlMain, deleteFile, unawaited, isNotEmpty, reductionSearchText, defaultLimit} = require('../module/const');
const {sendWebPush} = require('../module/webPush');
const EmploymentAzyk = require('../models/employmentAzyk');
const {parallelPromise} = require('../module/parallel');

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
`;

const mutation = `
    addMerchandising(organization: ID!, type: String!, geo: String, client: ID!, productAvailability: [String]!, productInventory: Boolean!, productConditions: Int!, productLocation: Int!, images: [Upload]!, fhos: [InputFho]!, needFho: Boolean!, stateProduct: Int!, comment: String!): ID
    checkMerchandising(_id: ID!, reviewerScore: Int, reviewerComment: String): String
    deleteMerchandising(_id: ID!): String
`;

const resolvers = {
    merchandisings: async(parent, {organization, agent, search, date, client, sort, filter, skip}, {user}) => {
        if(['admin', 'суперагент', 'суперорганизация', 'организация', 'менеджер', 'агент', 'мерчендайзер'].includes(user.role)) {
            let dateStart;
            let dateEnd;
            if(date&&date!=='') {
                dateStart = new Date(date)
                dateStart.setHours(0, 0, 0, 0)
                dateEnd = new Date(dateStart)
                dateEnd.setDate(dateEnd.getDate() + 1)
           }
            // eslint-disable-next-line no-undef
            const [districtClients, searchedClients] = await Promise.all([
                ['суперагент', 'агент', 'менеджер'].includes(user.role)?DistrictAzyk
                    .find({$or: [{manager: user.employment}, {agent: user.employment}]})
                    .distinct('client'):null,
                search?ClientAzyk.find({$or: [
                    {name: {$regex: reductionSearchText(search), $options: 'i'}},
                    {info: {$regex: reductionSearchText(search), $options: 'i'}},
                    {address: {$elemMatch: {$elemMatch: {$regex: reductionSearchText(search), $options: 'i'}}}}
                ]}).distinct('_id'):null
            ])
            return await MerchandisingAzyk.find({
                ...client?{client: client}:{},
                ...agent?{employment: agent}:{},
                organization: user.organization||(organization==='super'?null:organization),
                ...filter?
                    filter==='обработка'?{check: false}:{type: filter}
                    :{},
                ...date?{date: {$gte: dateStart, $lt:dateEnd}}:{},
                $and: [
                    {...['суперагент', 'агент'].includes(user.role) && districtClients.length||user.role==='менеджер'?{client: {$in: districtClients}}:['суперагент', 'агент', 'мерчендайзер'].includes(user.role)?{employment: user.employment}:{}},
                    {...search?{client: {$in: searchedClients}}:{}},
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
                .skip(isNotEmpty(skip) ? skip : 0)
                .limit(isNotEmpty(skip) ? defaultLimit : 10000000000)
                .lean()
       }
   },
    merchandising: async(parent, {_id}, {user}) => {
        if(mongoose.Types.ObjectId.isValid(_id)) {
            return await MerchandisingAzyk.findOne({
                ...user.organization?{organization: user.organization}:{},
                _id
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
   }
};

const resolversMutation = {
    addMerchandising: async(parent, {organization, type, client, geo, productAvailability, productInventory, productConditions, productLocation, images, fhos, needFho, stateProduct, comment}, {user}) => {
        if(['admin', 'суперагент', 'суперорганизация', 'организация', 'менеджер', 'агент', 'мерчендайзер'].includes(user.role)) {
            let _object = new MerchandisingAzyk({
                organization: user.organization||(organization==='super'?null:organization),
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
                fhos: [],
                images: [],
                geo: geo,
                check: false
           });
            if(images&&images.length)
                _object.images = await parallelPromise(images, async image => {
                    return urlMain + await saveBase64ToFile(image)
                })
            for(let i=0; i<fhos.length; i++) {
                _object.fhos.push(fhos[i])
           }
            const createdObject = await MerchandisingAzyk.create(_object)
            return createdObject._id;
       }
   },
    checkMerchandising: async(parent, {_id, reviewerScore, reviewerComment}, {user}) => {
        if(['admin', 'суперорганизация', 'организация', 'менеджер'].includes(user.role)) {
            let object = await MerchandisingAzyk.findOne({_id, ...user.organization?{organization: user.organization}:{}})
            object.check = true
            object.reviewerScore = reviewerScore
            object.reviewerComment = reviewerComment
            await object.save();
            unawaited(async () => {
                // eslint-disable-next-line no-undef
                const [client, employment] = await Promise.all([
                    ClientAzyk.findById(object.client).select('address').lean(),
                    EmploymentAzyk.findById(object.employment).select('user').lean(),
                ])
                if(employment)
                    await sendWebPush({
                        title: 'Мерчендайзинг',
                        message: `${client.address && client.address[0] && client.address[0][2] ? client.address[0][2] : ''}\nОценка: ${reviewerScore}${reviewerComment ? `\nКомментарий: ${reviewerComment}` : ''}`,
                        users: [employment.user],
                        url: `https://azyk.store/merchandising/${_id}`
                    })
            })
       }
        return 'OK'
   },
    deleteMerchandising: async(parent, {_id}, {user}) => {
        if(['admin', 'суперагент', 'суперорганизация', 'организация', 'менеджер', 'агент', 'мерчендайзер'].includes(user.role)) {
            const merchandisingImages = await MerchandisingAzyk.findOne({...user.organization?{organization: user.organization}:{}, _id}).select('images').lean()
            // eslint-disable-next-line no-undef
            await Promise.all([
                ...merchandisingImages.images.map(image => deleteFile(image)),
                MerchandisingAzyk.deleteOne({_id, ...user.organization?{organization: user.organization}:{}})
            ])
        }
        return 'OK'
   }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;