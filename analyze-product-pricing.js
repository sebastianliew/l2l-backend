#!/usr/bin/env node

import { MongoClient } from 'mongodb';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_NAME = process.env.MONGODB_DATABASE || 'l2l';

if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI not found in environment variables');
  process.exit(1);
}

class ProductPricingAnalyzer {
  constructor() {
    this.client = null;
    this.db = null;
  }

  async connect() {
    try {
      console.log('🔌 Connecting to MongoDB...');
      this.client = new MongoClient(MONGODB_URI);
      await this.client.connect();
      this.db = this.client.db(DATABASE_NAME);
      console.log(`✅ Connected to database: ${DATABASE_NAME}\n`);
    } catch (error) {
      console.error('❌ MongoDB connection error:', error.message);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      console.log('\n🔌 Disconnected from MongoDB');
    }
  }

  async getCollectionInfo() {
    try {
      const productsCount = await this.db.collection('products').countDocuments({});
      const transactionsCount = await this.db.collection('transactions').countDocuments({});
      
      console.log('📊 DATABASE OVERVIEW');
      console.log('='.repeat(50));
      console.log(`Total Products: ${productsCount.toLocaleString()}`);
      console.log(`Total Transactions: ${transactionsCount.toLocaleString()}`);
      console.log('');
    } catch (error) {
      console.error('Error getting collection info:', error);
    }
  }

  async analyzeProductPricing() {
    try {
      console.log('💰 PRODUCT PRICING ANALYSIS');
      console.log('='.repeat(50));

      // Get all products with basic pricing information
      const products = await this.db.collection('products').find(
        {},
        {
          projection: {
            name: 1,
            sku: 1,
            costPrice: 1,
            sellingPrice: 1,
            categoryName: 1,
            brandName: 1,
            isDeleted: 1,
            status: 1,
            currentStock: 1
          }
        }
      ).toArray();

      const activeProducts = products.filter(p => !p.isDeleted && p.status !== 'discontinued');
      
      // Categorize products by pricing status
      const noCostPrice = activeProducts.filter(p => 
        p.costPrice === null || p.costPrice === undefined || p.costPrice === 0
      );
      
      const noSellingPrice = activeProducts.filter(p => 
        p.sellingPrice === null || p.sellingPrice === undefined || p.sellingPrice === 0
      );
      
      const bothPricesSet = activeProducts.filter(p => 
        p.costPrice > 0 && p.sellingPrice > 0
      );
      
      const invalidPricing = activeProducts.filter(p => 
        p.costPrice > 0 && p.sellingPrice > 0 && p.sellingPrice < p.costPrice
      );

      console.log(`📈 Active Products Analysis (${activeProducts.length} total):`);
      console.log(`   • Products with NO cost price: ${noCostPrice.length} (${((noCostPrice.length/activeProducts.length)*100).toFixed(1)}%)`);
      console.log(`   • Products with NO selling price: ${noSellingPrice.length} (${((noSellingPrice.length/activeProducts.length)*100).toFixed(1)}%)`);
      console.log(`   • Products with BOTH prices set: ${bothPricesSet.length} (${((bothPricesSet.length/activeProducts.length)*100).toFixed(1)}%)`);
      console.log(`   • Products with selling price < cost price: ${invalidPricing.length} (${((invalidPricing.length/activeProducts.length)*100).toFixed(1)}%)`);
      console.log('');

      return {
        totalActive: activeProducts.length,
        noCostPrice: noCostPrice.length,
        noSellingPrice: noSellingPrice.length,
        bothPricesSet: bothPricesSet.length,
        invalidPricing: invalidPricing.length,
        noCostPriceProducts: noCostPrice.slice(0, 10), // Sample
        bothPricesProducts: bothPricesSet.slice(0, 10), // Sample
        invalidPricingProducts: invalidPricing
      };
    } catch (error) {
      console.error('Error analyzing product pricing:', error);
      throw error;
    }
  }

  async analyzeTransactionProductUsage() {
    try {
      console.log('🛒 TRANSACTION PRODUCT USAGE ANALYSIS');
      console.log('='.repeat(50));

      // Get products that appear in transactions
      const transactionProducts = await this.db.collection('transactions').aggregate([
        { $match: { status: { $ne: 'draft' } } },
        { $unwind: '$items' },
        { 
          $group: {
            _id: '$items.productId',
            productName: { $first: '$items.name' },
            transactionCount: { $sum: 1 },
            totalQuantitySold: { $sum: '$items.quantity' },
            totalRevenue: { $sum: '$items.totalPrice' },
            averageUnitPrice: { $avg: '$items.unitPrice' },
            latestTransactionDate: { $max: '$transactionDate' }
          }
        },
        { $sort: { transactionCount: -1 } }
      ]).toArray();

      console.log(`📦 Products in Transactions: ${transactionProducts.length}`);
      console.log('');

      // Cross-reference with product pricing data
      const productsWithPricing = await Promise.all(
        transactionProducts.slice(0, 20).map(async (txProduct) => {
          const productDetails = await this.db.collection('products').findOne(
            { _id: txProduct._id },
            { projection: { costPrice: 1, sellingPrice: 1, name: 1, sku: 1 } }
          );
          
          return {
            ...txProduct,
            costPrice: productDetails?.costPrice,
            sellingPrice: productDetails?.sellingPrice,
            sku: productDetails?.sku,
            hasCostPrice: !!(productDetails?.costPrice && productDetails.costPrice > 0),
            hasSellingPrice: !!(productDetails?.sellingPrice && productDetails.sellingPrice > 0),
            margin: productDetails?.costPrice && productDetails?.sellingPrice && productDetails.costPrice > 0 
              ? ((productDetails.sellingPrice - productDetails.costPrice) / productDetails.sellingPrice * 100).toFixed(1)
              : null
          };
        })
      );

      const productsInTransactionsWithoutCost = productsWithPricing.filter(p => !p.hasCostPrice);
      const productsInTransactionsWithoutSelling = productsWithPricing.filter(p => !p.hasSellingPrice);

      console.log(`🚨 Top selling products missing cost prices: ${productsInTransactionsWithoutCost.length}/20`);
      console.log(`🚨 Top selling products missing selling prices: ${productsInTransactionsWithoutSelling.length}/20`);
      console.log('');

      return {
        totalProductsInTransactions: transactionProducts.length,
        topProducts: productsWithPricing,
        missingCostPriceInTopProducts: productsInTransactionsWithoutCost.length,
        missingSellingPriceInTopProducts: productsInTransactionsWithoutSelling.length
      };
    } catch (error) {
      console.error('Error analyzing transaction product usage:', error);
      throw error;
    }
  }

  async showProductSamples(analysisData) {
    try {
      console.log('📋 PRODUCT SAMPLES');
      console.log('='.repeat(50));

      // Show sample of products without cost prices
      if (analysisData.noCostPriceProducts.length > 0) {
        console.log('🔴 Sample products WITHOUT cost prices:');
        analysisData.noCostPriceProducts.forEach((product, index) => {
          console.log(`   ${index + 1}. ${product.name} (${product.sku || 'No SKU'})`);
          console.log(`      Brand: ${product.brandName || 'N/A'} | Category: ${product.categoryName || 'N/A'}`);
          console.log(`      Cost: $${product.costPrice || '0.00'} | Selling: $${product.sellingPrice || '0.00'} | Stock: ${product.currentStock || 0}`);
          console.log('');
        });
      }

      // Show sample of products with both prices
      if (analysisData.bothPricesProducts.length > 0) {
        console.log('✅ Sample products WITH both prices set:');
        analysisData.bothPricesProducts.forEach((product, index) => {
          const margin = product.costPrice && product.sellingPrice && product.costPrice > 0
            ? ((product.sellingPrice - product.costPrice) / product.sellingPrice * 100).toFixed(1)
            : 'N/A';
          
          console.log(`   ${index + 1}. ${product.name} (${product.sku || 'No SKU'})`);
          console.log(`      Brand: ${product.brandName || 'N/A'} | Category: ${product.categoryName || 'N/A'}`);
          console.log(`      Cost: $${product.costPrice?.toFixed(2) || '0.00'} | Selling: $${product.sellingPrice?.toFixed(2) || '0.00'} | Margin: ${margin}%`);
          console.log('');
        });
      }

      // Show products with invalid pricing
      if (analysisData.invalidPricingProducts.length > 0) {
        console.log('⚠️  Products with INVALID pricing (selling < cost):');
        analysisData.invalidPricingProducts.forEach((product, index) => {
          console.log(`   ${index + 1}. ${product.name} (${product.sku || 'No SKU'})`);
          console.log(`      Cost: $${product.costPrice?.toFixed(2)} | Selling: $${product.sellingPrice?.toFixed(2)} | Loss: $${(product.costPrice - product.sellingPrice).toFixed(2)}`);
          console.log('');
        });
      }
    } catch (error) {
      console.error('Error showing product samples:', error);
    }
  }

  async showTopSellingProductsAnalysis(transactionData) {
    try {
      console.log('🏆 TOP SELLING PRODUCTS PRICING ANALYSIS');
      console.log('='.repeat(50));

      console.log('Top 20 products by transaction count:');
      console.log('');

      transactionData.topProducts.forEach((product, index) => {
        const status = product.hasCostPrice && product.hasSellingPrice ? '✅' : 
                      !product.hasCostPrice ? '❌ No Cost' :
                      !product.hasSellingPrice ? '❌ No Selling' : '⚠️';
        
        console.log(`${index + 1}. ${status} ${product.productName}`);
        console.log(`   SKU: ${product.sku || 'N/A'} | Transactions: ${product.transactionCount}`);
        console.log(`   Revenue: $${product.totalRevenue.toFixed(2)} | Avg Unit Price: $${product.averageUnitPrice.toFixed(2)}`);
        
        if (product.costPrice && product.sellingPrice) {
          console.log(`   Cost: $${product.costPrice.toFixed(2)} | Selling: $${product.sellingPrice.toFixed(2)} | Margin: ${product.margin}%`);
        } else {
          console.log(`   Cost: $${product.costPrice?.toFixed(2) || 'N/A'} | Selling: $${product.sellingPrice?.toFixed(2) || 'N/A'} | Margin: N/A`);
        }
        console.log(`   Last sold: ${new Date(product.latestTransactionDate).toLocaleDateString()}`);
        console.log('');
      });
    } catch (error) {
      console.error('Error showing top selling products analysis:', error);
    }
  }

  async generateSummaryReport(analysisData, transactionData) {
    try {
      console.log('📊 EXECUTIVE SUMMARY REPORT');
      console.log('='.repeat(50));

      const completenessScore = ((analysisData.bothPricesSet / analysisData.totalActive) * 100).toFixed(1);
      const criticalMissingData = (analysisData.noCostPrice / analysisData.totalActive) * 100;

      console.log('🎯 KEY METRICS:');
      console.log(`   • Pricing Data Completeness: ${completenessScore}%`);
      console.log(`   • Products Missing Cost Prices: ${analysisData.noCostPrice} (${((analysisData.noCostPrice/analysisData.totalActive)*100).toFixed(1)}%)`);
      console.log(`   • Products in Active Use: ${transactionData.totalProductsInTransactions}`);
      console.log(`   • Top Sellers Missing Cost Data: ${transactionData.missingCostPriceInTopProducts}/20`);
      console.log('');

      console.log('🚨 PRIORITY ACTIONS NEEDED:');
      if (criticalMissingData > 30) {
        console.log('   • HIGH PRIORITY: Over 30% of products missing cost prices');
      }
      if (transactionData.missingCostPriceInTopProducts > 5) {
        console.log('   • HIGH PRIORITY: Top selling products missing cost data');
      }
      if (analysisData.invalidPricing > 0) {
        console.log(`   • MEDIUM PRIORITY: ${analysisData.invalidPricing} products have selling price below cost price`);
      }
      if (completenessScore < 80) {
        console.log('   • MEDIUM PRIORITY: Pricing data completeness below 80%');
      }

      console.log('');
      console.log('💡 RECOMMENDATIONS:');
      console.log('   1. Set cost prices for top-selling products first');
      console.log('   2. Review and fix products with invalid pricing');
      console.log('   3. Implement validation rules to prevent zero/null cost prices');
      console.log('   4. Regular pricing audits for margin optimization');
      console.log('');

      // Generate timestamp for report
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportSummary = {
        reportDate: new Date().toISOString(),
        totalActiveProducts: analysisData.totalActive,
        pricingCompleteness: completenessScore,
        missingCostPrices: analysisData.noCostPrice,
        missingSellingPrices: analysisData.noSellingPrice,
        invalidPricing: analysisData.invalidPricing,
        topSellersWithoutCostPrice: transactionData.missingCostPriceInTopProducts,
        recommendations: [
          'Set cost prices for top-selling products first',
          'Review and fix products with invalid pricing',
          'Implement validation rules to prevent zero/null cost prices',
          'Regular pricing audits for margin optimization'
        ]
      };

      console.log(`📄 Report summary saved to: product-pricing-analysis-${timestamp}.json`);
      fs.writeFileSync(
        path.join(__dirname, `product-pricing-analysis-${timestamp}.json`),
        JSON.stringify(reportSummary, null, 2)
      );

    } catch (error) {
      console.error('Error generating summary report:', error);
    }
  }

  async run() {
    try {
      await this.connect();
      await this.getCollectionInfo();
      
      const analysisData = await this.analyzeProductPricing();
      const transactionData = await this.analyzeTransactionProductUsage();
      
      await this.showProductSamples(analysisData);
      await this.showTopSellingProductsAnalysis(transactionData);
      await this.generateSummaryReport(analysisData, transactionData);
      
    } catch (error) {
      console.error('❌ Analysis failed:', error);
      process.exit(1);
    } finally {
      await this.disconnect();
    }
  }
}

// Run the analysis
const analyzer = new ProductPricingAnalyzer();
analyzer.run().catch(console.error);

export default ProductPricingAnalyzer;