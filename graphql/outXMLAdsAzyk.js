const SingleOutXMLAdsAzyk = require('../models/singleOutXMLAdsAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const {reductionSearch} = require('../module/const');


const type = `
  type OutXMLAdsShoro {
    _id: ID
    createdAt: Date
    guid: String
    organization: Organization
    district: District
 }
`;

const query = `
    outXMLAdsShoros(organization: ID!, search: String!): [OutXMLAdsShoro]
    districtsOutXMLAdsShoros(organization: ID!): [District]
`;

const mutation = `
    addOutXMLAdsShoro(organization: ID!, district: ID!, guid: String!): OutXMLAdsShoro
    setOutXMLAdsShoro(_id: ID!, guid: String): String
    deleteOutXMLAdsShoro(_id: ID!): String
`;

const resolvers = {
    districtsOutXMLAdsShoros: async(parent, {organization}, {user}) => {
        if (user.role === 'admin') {
            let districts = await SingleOutXMLAdsAzyk.find({organization}).distinct('district')
            return DistrictAzyk.find({organization, _id: {$nin: districts}}).lean()
       }
   },
    outXMLAdsShoros: async(parent, {organization, search}, {user}) => {
        if (user.role === 'admin') {
            let searchedDistricts;
            if (search) {
                searchedDistricts = await DistrictAzyk.find({name: {$regex: reductionSearch(search), $options: 'i'}}).distinct('_id').lean()
           }
            return await SingleOutXMLAdsAzyk.find({
                organization, ...search?{district: {'$in': searchedDistricts}}:{}
           })
                .populate('district')
                .sort('-createdAt')
                .lean()
       }
   }
};

const resolversMutation = {
    addOutXMLAdsShoro: async(parent, {organization, district, guid}, {user}) => {
        if(user.role==='admin') {
            // eslint-disable-next-line no-undef
            const [createdObject, districtData] = await Promise.all([
                SingleOutXMLAdsAzyk.create({guid, organization, district}),
                DistrictAzyk.findById(district).select('_id name').lean()
            ]);
            return {...createdObject.toObject(), district: districtData}
       }
   },
    setOutXMLAdsShoro: async(parent, {_id, guid}, {user}) => {
        if(user.role==='admin') {
            await SingleOutXMLAdsAzyk.updateOne({_id}, {guid})
       }
        return 'OK'
   },
    deleteOutXMLAdsShoro: async(parent, {_id}, {user}) => {
        if(user.role==='admin') {
            await SingleOutXMLAdsAzyk.deleteOne({_id})
       }
        return 'OK'
   }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;