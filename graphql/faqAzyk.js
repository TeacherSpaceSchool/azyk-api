const FaqAzyk = require('../models/faqAzyk');
const {deleteFile, reductionSearchText} = require('../module/const');
const {roleList} = require('../module/enum');

const type = `
  type Faq {
    _id: ID
    title: String
    video: String
    typex: String
    createdAt: Date
 }
`;

const query = `
    faqs(search: String!): [Faq]
`;

const mutation = `
    addFaq(title: String!, typex: String!, video: String!): Faq
    setFaq(_id: ID!, title: String, typex: String, video: String): String
    deleteFaq(_id: ID!): String
`;

const resolvers = {
    faqs: async(parent, {search}, {user}) => {
        if(user.role) {
            let typex = ''
            if (user.role === roleList.client)
                typex = 'клиенты'
            else if (user.role!==roleList.admin)
                typex = 'сотрудники'
            return await FaqAzyk.find({
                ...search?{title: {$regex: reductionSearchText(search), $options: 'i'}}:{},
                ...typex?{typex}:{}
           }).sort('title').lean()
       }
   }
};

const resolversMutation = {
    addFaq: async(parent, {title, video, typex}, {user}) => {
        if(user.role===roleList.admin) {
            return FaqAzyk.create({title, typex, video})
       }
   },
    setFaq: async(parent, {_id, title, video, typex}, {user}) => {
        if(user.role===roleList.admin) {
            let object = await FaqAzyk.findById(_id)
            if(title) object.title = title
            if(video) object.video = video
            if(typex) object.typex = typex
            await object.save();
       }
        return 'OK'
   },
    deleteFaq: async(parent, {_id}, {user}) => {
        if(user.role===roleList.admin) {
            let objects = await FaqAzyk.findById(_id).select('file').lean()
            // eslint-disable-next-line no-undef
            await Promise.all([
                deleteFile(objects.file),
                FaqAzyk.deleteOne({_id})
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