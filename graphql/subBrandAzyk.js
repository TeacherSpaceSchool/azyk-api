const SubBrandAzyk = require('../models/subBrandAzyk');
const ItemAzyk = require('../models/itemAzyk');
const {saveImage, deleteFile, urlMain, reductionSearchText, isNotEmpty, unawaited} = require('../module/const');
const OrganizationAzyk = require('../models/organizationAzyk');
const {addHistory, historyTypes} = require('../module/history');
const {roleList} = require('../module/enum');

const type = `
  type SubBrand {
     _id: ID
     createdAt: Date
     image: String
     guid: String
     miniInfo: String
     name: String
     cities: [String]
     priotiry: Int
     minimumOrder: Int
     organization: Organization
     status: String
}
`;

const query = `
    subBrands(organization: ID, search: String!, city: String): [SubBrand]
    subBrand(_id: ID!): SubBrand
`;

const mutation = `
    addSubBrand(image: Upload!, minimumOrder: Int, miniInfo: String!, priotiry: Int, organization: ID!, name: String!, guid: String!): ID
    setSubBrand(_id: ID!, minimumOrder: Int, image: Upload, miniInfo: String, priotiry: Int, name: String, guid: String): String
    onoffSubBrand(_id: ID!): String
    deleteSubBrand(_id: ID!): String
    setSubBrandForItems(subBrand: ID!, selectedItems: [ID]!, unselectedItems: [ID]!): String
`;

const resolvers = {
    subBrands: async(parent, {organization, search, city}, {user}) => {
        if([roleList.admin, 'суперагент', 'экспедитор', 'суперорганизация', 'организация', 'менеджер', 'агент', roleList.client].includes(user.role)) {
            if(user.organization) organization = user.organization
            return await SubBrandAzyk.find({
                del: {$ne: 'deleted'},
                ...search?{$or: [
                    {name: {$regex: reductionSearchText(search), $options: 'i'}},
                    {miniInfo: {$regex: reductionSearchText(search), $options: 'i'}}
                ]}:{},
                ...organization?{organization}:{},
                ...city?{cities: city}:{},
                ...![roleList.admin, 'суперорганизация', 'организация'].includes(user.role)?{status: 'active'}:{}
           })
                .populate({
                    path: 'organization',
                    select: '_id name'
               })
                .sort('-priotiry')
                .lean()
       }
   },
    subBrand: async(parent, {_id}, {user}) => {
        return await SubBrandAzyk.findOne({
            _id,
            ...user.organization?{organization: user.organization}:{},
        })
            .populate({
                path: 'organization',
                select: '_id name'
            })
            .lean()
    }
};

const resolversMutation = {
    addSubBrand: async(parent, {minimumOrder, image, miniInfo, priotiry, organization, guid, name}, {user}) => {
        if([roleList.admin, 'суперорганизация', 'организация'].includes(user.role)) {
            if(user.organization) organization = user.organization
            organization = await OrganizationAzyk.findById(organization).select('_id name cities').lean()
            let {stream, filename} = await image;
            image = urlMain + await saveImage(stream, filename)
            // eslint-disable-next-line no-undef
            const createdObject = await SubBrandAzyk.create({
                image, guid, priotiry, minimumOrder, miniInfo, organization: organization._id, cities: organization.cities, name, status: 'active'
            })
            unawaited(() => addHistory({user, type: historyTypes.create, model: 'SubBrandAzyk', name, object: createdObject._id}))
            return createdObject._id
       }
   },
    setSubBrand: async(parent, {_id, image, minimumOrder, miniInfo, priotiry, guid, name}, {user}) => {
        if([roleList.admin, 'суперорганизация', 'организация'].includes(user.role)) {
            let object = await SubBrandAzyk.findOne({
                _id,
                ...user.organization?{organization: user.organization}:{}
            })
            unawaited(() => addHistory({user, type: historyTypes.set, model: 'SubBrandAzyk', name: object.name, object: _id, data: {image, minimumOrder, miniInfo, priotiry, name}}))
            if (image) {
                let {stream, filename} = await image;
                // eslint-disable-next-line no-undef
                const [savedFilename] = await Promise.all([
                    saveImage(stream, filename),
                    deleteFile(object.image)
                ])
                object.image = urlMain + savedFilename
            }
            if(isNotEmpty(minimumOrder))object.minimumOrder = minimumOrder
            if(isNotEmpty(miniInfo))object.miniInfo = miniInfo
            if(name)object.name = name
            if(guid)object.guid = guid
            if(isNotEmpty(priotiry)) object.priotiry = priotiry
            await object.save();
        }
        return 'OK'
   },
    onoffSubBrand: async(parent, {_id}, {user}) => {
        if([roleList.admin, 'суперорганизация', 'организация'].includes(user.role)) {
            const subBrand = await SubBrandAzyk.findOne({_id, ...user.organization?{organization: user.organization}:{}})
            subBrand.status = subBrand.status === 'active' ? 'deactive' : 'active';
            subBrand.save();
            unawaited(() => addHistory({user, type: historyTypes.set, model: 'SubBrandAzyk', name: subBrand.name, object: _id, data: {status: subBrand.status}}))
       }
        return 'OK'
   },
    deleteSubBrand: async(parent, {_id}, {user}) => {
        if([roleList.admin, 'суперорганизация', 'организация'].includes(user.role)) {
            let subBrand = await SubBrandAzyk.findById(_id).select('name').lean()
            // eslint-disable-next-line no-undef
            await Promise.all([
                SubBrandAzyk.updateOne({_id, ...user.organization?{organization: user.organization}:{}}, {del: 'deleted'}),
                ItemAzyk.updateMany({subBrand: _id, ...user.organization?{organization: user.organization}:{}}, {subBrand: null})
            ])
            unawaited(() => addHistory({user, type: historyTypes.delete, model: 'SubBrandAzyk', name: subBrand.name, object: _id}))
       }
        return 'OK'
   },
    setSubBrandForItems: async(parent, {subBrand, selectedItems, unselectedItems}, {user}) => {
        if([roleList.admin, 'суперорганизация', 'организация'].includes(user.role)) {
            // eslint-disable-next-line no-undef
            await Promise.all([
                ItemAzyk.updateMany({_id: {$in: selectedItems}, subBrand: {$ne: subBrand}, ...user.organization?{organization: user.organization}:{}}, {subBrand}),
                ItemAzyk.updateMany({_id: {$in: unselectedItems}, subBrand, ...user.organization?{organization: user.organization}:{}}, {subBrand: null})
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