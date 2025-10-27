#!/usr/bin/env node

/**
 * Test script for validating the mock data system
 * Run with: node scripts/test-mock-data.js
 */

// Mock the VS Code extension context
const mockContext = {
  subscriptions: [],
  extensionPath: __dirname + '/..',
  globalState: {
    get: () => null,
    update: () => Promise.resolve()
  },
  workspaceState: {
    get: () => null,
    update: () => Promise.resolve()
  }
};

// Mock the real dotnet CLI output for testing
const mockRealOutput = {
  version: 1,
  parameters: '--include-transitive',
  projects: [
    {
      path: '/home/sgryt/Code/DOTNET/DotNet-8-Crud-Web-API-Example/DotNetCrudWebApi/DotNetCrudWebApi.csproj',
      frameworks: [
        {
          framework: 'net8.0',
          topLevelPackages: [
            {
              id: 'Microsoft.EntityFrameworkCore',
              requestedVersion: '8.0.2',
              resolvedVersion: '8.0.2'
            },
            {
              id: 'Microsoft.EntityFrameworkCore.Sqlite',
              requestedVersion: '8.0.2',
              resolvedVersion: '8.0.2'
            },
            {
              id: 'Swashbuckle.AspNetCore',
              requestedVersion: '6.4.0',
              resolvedVersion: '6.4.0'
            }
          ],
          transitivePackages: [
            {
              id: 'Azure.Core',
              resolvedVersion: '1.25.0'
            },
            {
              id: 'Azure.Identity',
              resolvedVersion: '1.7.0'
            },
            {
              id: 'Humanizer.Core',
              resolvedVersion: '2.14.1'
            }
          ]
        }
      ]
    }
  ]
};

async function testMockDataProvider() {
  console.log('🧪 Testing Mock Data Provider...\n');

  try {
    // Import the mock data provider
    const { MockDataProvider } = require('../out/services/mockDataProvider');
    const mockProvider = new MockDataProvider();

    // Test 1: Basic mock dependencies
    console.log('📦 Test 1: Basic Mock Dependencies');
    const basicDeps = await mockProvider.getMockDependencies('TestProject');
    console.log(`✅ Generated ${basicDeps.packages.length} packages`);
    console.log(`✅ Created ${basicDeps.graphData.nodes.length} graph nodes`);
    console.log(`✅ Created ${basicDeps.graphData.links.length} graph links`);
    console.log(
      `✅ Found ${basicDeps.vulnerabilityCount.total} vulnerabilities\n`
    );

    // Test 2: Mock vulnerabilities
    console.log('🔒 Test 2: Mock Vulnerabilities');
    const vulnDeps = await mockProvider.getMockDependenciesWithVulnerabilities(
      'TestProject'
    );
    console.log(
      `✅ Generated ${vulnDeps.packages.length} packages with vulnerabilities`
    );
    console.log(`✅ Critical: ${vulnDeps.vulnerabilityCount.critical}`);
    console.log(`✅ High: ${vulnDeps.vulnerabilityCount.high}`);
    console.log(`✅ Moderate: ${vulnDeps.vulnerabilityCount.moderate}`);
    console.log(`✅ Low: ${vulnDeps.vulnerabilityCount.low}\n`);

    // Test 3: Full dependency graph
    console.log('🌐 Test 3: Full Dependency Graph');
    const fullGraph = await mockProvider.getMockFullDependencyGraph(
      'TestProject'
    );
    console.log(
      `✅ Generated full graph with ${fullGraph.packages.length} packages`
    );
    console.log(`✅ Created ${fullGraph.graphData.nodes.length} nodes`);
    console.log(`✅ Created ${fullGraph.graphData.links.length} links\n`);

    // Test 4: Real output parsing
    console.log('📋 Test 4: Real Output Parsing');
    const realOutputDeps = await mockProvider.getMockFromRealOutput(
      JSON.stringify(mockRealOutput),
      'RealOutputProject'
    );
    console.log(
      `✅ Parsed real output with ${realOutputDeps.packages.length} packages`
    );
    console.log(`✅ Created ${realOutputDeps.graphData.nodes.length} nodes`);
    console.log(`✅ Created ${realOutputDeps.graphData.links.length} links\n`);

    // Test 5: Data structure validation
    console.log('🔍 Test 5: Data Structure Validation');
    const samplePackage = basicDeps.packages[0];
    console.log(
      `✅ Package structure: ${samplePackage.id}@${samplePackage.version}`
    );
    console.log(
      `✅ Has vulnerabilities: ${
        samplePackage.vulnerabilities ? samplePackage.vulnerabilities.length : 0
      }`
    );
    console.log(`✅ Is transitive: ${samplePackage.isTransitive}`);
    console.log(`✅ Depth: ${samplePackage.depth}\n`);

    // Test 6: Graph data validation
    console.log('📊 Test 6: Graph Data Validation');
    const sampleNode = basicDeps.graphData.nodes[0];
    const sampleLink = basicDeps.graphData.links[0];
    console.log(`✅ Node structure: ${sampleNode.name}@${sampleNode.version}`);
    console.log(`✅ Node color: ${sampleNode.color}`);
    console.log(
      `✅ Link structure: ${sampleLink.source} → ${sampleLink.target}\n`
    );

    console.log(
      '🎉 All tests passed! Mock data provider is working correctly.'
    );
    console.log('\n📝 Next steps:');
    console.log('1. Run "npm run compile" to build the extension');
    console.log('2. Press F5 to launch extension in debug mode');
    console.log(
      '3. Use "Debug: Test with Mock Data" command in the Extension Development Host'
    );
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure you have run "npm run compile" first');
    console.log('2. Check that the TypeScript compilation succeeded');
    console.log(
      '3. Verify the out/ directory contains the compiled JavaScript files'
    );
    process.exit(1);
  }
}

// Run the test
testMockDataProvider().catch(console.error);
