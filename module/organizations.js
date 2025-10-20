//organization
const warehouseAzyk = require('../models/warehouseAzyk');const subBrandAzyk = require('../models/subBrandAzyk');const stockAzyk = require('../models/stockAzyk');
const specialPriceClientAzyk = require('../models/specialPriceClientAzyk');const specialPriceCategoryAzyk = require('../models/specialPriceCategoryAzyk');
const singleOutXMLReturnedAzyk = require('../models/singleOutXMLReturnedAzyk');const singleOutXMLAzyk = require('../models/singleOutXMLAzyk');
const singleOutXMLAdsAzyk = require('../models/singleOutXMLAdsAzyk');const reviewAzyk = require('../models/reviewAzyk');
const returnedAzyk = require('../models/returnedAzyk');const planClientAzyk = require('../models/planClientAzyk');
const merchandisingAzyk = require('../models/merchandisingAzyk');const limitItemClientAzyk = require('../models/limitItemClientAzyk');
const itemAzyk = require('../models/itemAzyk');const invoiceAzyk = require('../models/invoiceAzyk');const integrate1CAzyk = require('../models/integrate1CAzyk');
const equipmentAzyk = require('../models/equipmentAzyk');const employmentAzyk = require('../models/employmentAzyk');const adsAzyk = require('../models/adsAzyk');
const districtAzyk = require('../models/districtAzyk');const discountClientAzyk = require('../models/discountClientAzyk');
const deliveryDateAzyk = require('../models/deliveryDateAzyk');const agentRouteAzyk = require('../models/agentRouteAzyk');
//other
/*_id*/const userAzyk = require('../models/userAzyk');/*user*/const subscriberAzyk = require('../models/subscriberAzyk');
/*_id*/const organizationAzyk = require('../models/organizationAzyk');/*item*/const orderAzyk = require('../models/orderAzyk');
/*item*/const basketAzyk = require('../models/basketAzyk');/*item*/const historyStockAzyk = require('../models/historyStockAzyk');
/*invoice*/const historyOrderAzyk = require('../models/historyOrderAzyk');/*agent*/const agentHistoryGeoAzyk = require('../models/agentHistoryGeoAzyk');
//deleteOrganizations
module.exports.deleteOrganizations = async(organizations) => {
    console.log('deleteOrganizations start')
    //by other field
    // eslint-disable-next-line no-undef
    const [employments, employmentUsers, items, invoices] = await Promise.all([
        employmentAzyk.find({organization: {$in: organizations}}).distinct('_id'), employmentAzyk.find({organization: {$in: organizations}}).distinct('user'),
        itemAzyk.find({organization: {$in: organizations}}).distinct('_id'), invoiceAzyk.find({organization: {$in: organizations}}).distinct('_id'),
        returnedAzyk.find({organization: {$in: organizations}}).distinct('_id')
    ])
    // eslint-disable-next-line no-undef
    await Promise.all([
        userAzyk.deleteMany({_id: {$in: employmentUsers}}), subscriberAzyk.deleteMany({user: {$in: employmentUsers}}),
        orderAzyk.deleteMany({item: {$in: items}}), basketAzyk.deleteMany({item: {$in: items}}), historyStockAzyk.deleteMany({item: {$in: items}}),
        routeAzyk.deleteMany({provider: {$in: organizations}}), agentHistoryGeoAzyk.deleteMany({agent: {$in: employments}}),
        historyOrderAzyk.deleteMany({invoice: {$in: invoices}}),
    ]);
    //by organization
    // eslint-disable-next-line no-undef
    await Promise.all([
        warehouseAzyk.deleteMany({organization: {$in: organizations}}), subBrandAzyk.deleteMany({organization: {$in: organizations}}),
        stockAzyk.deleteMany({organization: {$in: organizations}}), specialPriceClientAzyk.deleteMany({organization: {$in: organizations}}),
        specialPriceCategoryAzyk.deleteMany({organization: {$in: organizations}}), singleOutXMLAzyk.deleteMany({organization: {$in: organizations}}),
        singleOutXMLReturnedAzyk.deleteMany({organization: {$in: organizations}}), singleOutXMLAdsAzyk.deleteMany({organization: {$in: organizations}}),
        returnedAzyk.deleteMany({organization: {$in: organizations}}), repairEquipmentAzyk.deleteMany({organization: {$in: organizations}}),
        reviewAzyk.deleteMany({organization: {$in: organizations}}), merchandisingAzyk.deleteMany({organization: {$in: organizations}}),
        limitItemClientAzyk.deleteMany({organization: {$in: organizations}}), itemAzyk.deleteMany({organization: {$in: organizations}}),
        invoiceAzyk.deleteMany({organization: {$in: organizations}}), integrate1CAzyk.deleteMany({organization: {$in: organizations}}),
        equipmentAzyk.deleteMany({organization: {$in: organizations}}), employmentAzyk.deleteMany({organization: {$in: organizations}}),
        adsAzyk.deleteMany({organization: {$in: organizations}}), districtAzyk.deleteMany({organization: {$in: organizations}}),
        discountClientAzyk.deleteMany({organization: {$in: organizations}}), autoAzyk.deleteMany({organization: {$in: organizations}}),
        deliveryDateAzyk.deleteMany({organization: {$in: organizations}}), agentRouteAzyk.deleteMany({organization: {$in: organizations}}),
        planClientAzyk.deleteMany({organization: {$in: organizations}}),
        organizationAzyk.deleteMany({_id: {$in: organizations}})
    ])
    console.log('deleteOrganizations end')
}