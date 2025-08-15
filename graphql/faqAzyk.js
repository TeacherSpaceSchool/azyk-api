const FaqAzyk = require('../models/faqAzyk');
const {saveFile, deleteFile, urlMain, saveImage, reductionSearchText} = require('../module/const');

const type = `
  type Faq {
    _id: ID
    url: String
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
    addFaq(file: Upload, title: String!, typex: String!, video: String): Faq
    setFaq(_id: ID!, file: Upload, title: String, typex: String, video: String): String
    deleteFaq(_id: ID!): String
`;

const resolvers = {
    faqs: async(parent, {search}, {user}) => {
        if(user.role) {
            let typex = ''
            if (user.role === 'client')
                typex = 'клиенты'
            else if (user.role!=='admin')
                typex = 'сотрудники'
            return await FaqAzyk.find({
                ...search?{title: {$regex: reductionSearchText(search), $options: 'i'}}:{},
                ...typex?{typex}:{}
           }).sort('title').lean()
       }
   }
};

const resolversMutation = {
    addFaq: async(parent, {file, title, video, typex}, {user}) => {
        if(user.role==='admin') {
            let url
            if (file) {
                let {stream, filename} = await file;
                url = urlMain + await saveFile(stream, filename)
           }
            return FaqAzyk.create({title, typex, video, url})
       }
   },
    setFaq: async(parent, {_id, file, title, video, typex}, {user}) => {
        if(user.role==='admin') {
            let object = await FaqAzyk.findById(_id)
            if (file) {
                let {stream, filename} = await file;
                // eslint-disable-next-line no-undef
                const [savedFilename] = await Promise.all([
                    saveImage(stream, filename),
                    deleteFile(object.url)
                ])
                object.url = urlMain + savedFilename
           }
            if(title) object.title = title
            if(video) object.video = video
            if(typex) object.typex = typex
            await object.save();
       }
        return 'OK'
   },
    deleteFaq: async(parent, {_id}, {user}) => {
        if(user.role==='admin') {
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