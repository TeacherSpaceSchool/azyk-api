const FaqAzyk = require('../models/faqAzyk');
const { saveFile, deleteFile, urlMain, reductionSearch} = require('../module/const');

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
    setFaq(_id: ID!, file: Upload, title: String, typex: String, video: String): Data
    deleteFaq(_id: [ID]!): Data
`;

const resolvers = {
    faqs: async(parent, {search}, {user}) => {
        /*let typex = ''
        if(user.role==='client')
            typex='клиенты'
        else if(['суперорганизация', 'организация', 'менеджер', 'экспедитор', 'агент'].includes(user.role))
            typex='сотрудники'*/
        return await FaqAzyk.find({
            title: {'$regex': reductionSearch(search), '$options': 'i'},
            typex: {'$regex': reductionSearch(search), '$options': 'i'},
        }).sort('title').lean()
    }
};

const resolversMutation = {
    addFaq: async(parent, {file, title, video, typex}, {user}) => {
        if(user.role==='admin') {
            let _object = new FaqAzyk({
                title: title,
                typex: typex
            });
            if (file) {
                let {stream, filename} = await file;
                filename = await saveFile(stream, filename)
                _object.url = urlMain+filename
            }
            if(video)_object.video = video
            _object = await FaqAzyk.create(_object)
            return _object
        }
    },
    setFaq: async(parent, {_id, file, title, video, typex}, {user}) => {
        if(user.role==='admin') {
            let object = await FaqAzyk.findById(_id)
            if (file) {
                let {stream, filename} = await file;
                if(object.url) await deleteFile(object.url)
                 filename = await saveFile(stream, filename)
                object.url = urlMain + filename
            }
            if(title) object.title = title
            if(video) object.video = video
            if(typex) object.typex = typex
            await object.save();
        }
        return {data: 'OK'}
    },
    deleteFaq: async(parent, { _id }, {user}) => {
        if(user.role==='admin'){
            let objects = await FaqAzyk.find({_id: {$in: _id}}).select('file').lean()
            for(let i=0; i<objects.length; i++){
                if(objects[i].file)
                    await deleteFile(objects[i].file)
            }
            await FaqAzyk.deleteMany({_id: {$in: _id}})
        }
        return {data: 'OK'}
    }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;