const BannersAzyk = require('../models/bannersAzyk');
const {saveBase64ToFile, urlMain, deleteFile} = require('../module/const');

const type = `
  type Banners {
      _id: ID
      createdAt: Date
      images: [String]
 }
`;

const query = `
    banners: Banners
`;

const mutation = `
    setBanners(deletedImages: [Upload]!, uploads: [Upload]!): String
`;

const resolvers = {
    banners: async(parent, args, {user}) => {
        if(['admin', 'client'].includes(user.role))
            return await BannersAzyk.findOne().lean()
   }
};

const resolversMutation = {
    setBanners: async(parent, {deletedImages, uploads}, {user}) => {
        if(user.role==='admin') {
            let object = await BannersAzyk.findOne().select('images').lean()
            let images = object.images
            if(deletedImages.length)
                images = images.filter(image => !deletedImages.includes(image))
            // eslint-disable-next-line no-undef
            await Promise.all([
                ...deletedImages.length?deletedImages.map(deletedImage => deleteFile(deletedImage)):[],
                ...uploads.length?uploads.map(async upload => {images.push(urlMain + await saveBase64ToFile(upload))}):[]
            ])
            await BannersAzyk.updateOne({}, {images})
        }
        return 'OK'
   }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;