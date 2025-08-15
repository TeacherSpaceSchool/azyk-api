const BlogAzyk = require('../models/blogAzyk');
const {saveImage, deleteFile, urlMain, reductionSearchText} = require('../module/const');

const type = `
  type Blog {
    _id: ID
    image: String
    text: String
    title: String
    createdAt: Date
 }
`;

const query = `
    blogs(search: String!): [Blog]
`;

const mutation = `
    addBlog(image: Upload!, text: String!, title: String!): Blog
    setBlog(_id: ID!, image: Upload, text: String, title: String): String
    deleteBlog(_id: ID!): String
`;

const resolvers = {
    blogs: async(parent, {search}) => {
        return await BlogAzyk.find({
            title: {$regex: reductionSearchText(search), $options: 'i'}
       })
            .sort('-createdAt')
            .lean()
   }
};

const resolversMutation = {
    addBlog: async(parent, {image, text, title}, {user}) => {
        if(user.role==='admin') {
            let {stream, filename} = await image;
            image = urlMain + await saveImage(stream, filename)
            const createdObject = await BlogAzyk.create({image, text, title})
            return createdObject
       }
        return 'OK';
   },
    setBlog: async(parent, {_id, image, text, title}, {user}) => {
        if(user.role==='admin') {
            let object = await BlogAzyk.findById(_id)
            if (image) {
                let {stream, filename} = await image;
                // eslint-disable-next-line no-undef
                const [savedFilename] = await Promise.all([
                    saveImage(stream, filename),
                    deleteFile(object.image)
                ])
                object.image = urlMain + savedFilename
           }
            if(text) object.text = text
            if(title) object.title = title
            await object.save();
       }
        return 'OK'
   },
    deleteBlog: async(parent, {_id}, {user}) => {
        if(user.role==='admin') {
            let blog = await BlogAzyk.findOne({_id: {$in: _id}}).select('image').lean()
            // eslint-disable-next-line no-undef
            await Promise.all([
                deleteFile(blog.image),
                BlogAzyk.deleteOne({_id})
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