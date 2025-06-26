
'use server';
/**
 * @fileOverview ProjectService - Manages investment projects and user investments using MongoDB.
 */

import { MongoClient, type Db, type Collection, type WithId } from 'mongodb';
import type { Project, Investment, NewProjectInput } from '@/types/project';

console.log(`[${new Date().toISOString()}] [projectService] Module loading. Attempting to read MONGODB_URI...`);

let MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_URI_FALLBACK = "mongodb+srv://haithammisape:hrz123@cluster0.quboghr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

if (!MONGODB_URI) {
  const timestamp = new Date().toISOString();
  console.warn(`[${timestamp}] [projectService] WARNING: MONGODB_URI was not found. Using fallback.`);
  MONGODB_URI = MONGODB_URI_FALLBACK;
}

const DB_NAME = process.env.MONGODB_DB_NAME || 'binanceTrailblazerDb';
const PROJECTS_COLLECTION = 'projects';
const INVESTMENTS_COLLECTION = 'investments';

interface CustomGlobal extends NodeJS.Global {
  _mongoProjectClientPromise?: Promise<MongoClient>;
}
declare const global: CustomGlobal;

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoProjectClientPromise) {
    if (!MONGODB_URI) throw new Error("CRITICAL: MONGODB_URI is undefined.");
    client = new MongoClient(MONGODB_URI);
    global._mongoProjectClientPromise = client.connect();
    console.log(`[${new Date().toISOString()}] [MongoDB - Projects] New connection promise created (development).`);
  }
  clientPromise = global._mongoProjectClientPromise;
} else {
  if (!MONGODB_URI) throw new Error("CRITICAL: MONGODB_URI is undefined.");
  client = new MongoClient(MONGODB_URI);
  clientPromise = client.connect();
  console.log(`[${new Date().toISOString()}] [MongoDB - Projects] New connection promise created (production).`);
}

async function getDb(): Promise<Db> {
  const connectedClient = await clientPromise;
  return connectedClient.db(DB_NAME);
}

async function getProjectsCollection(): Promise<Collection<Project>> {
  const db = await getDb();
  return db.collection<Project>(PROJECTS_COLLECTION);
}

async function getInvestmentsCollection(): Promise<Collection<Investment>> {
  const db = await getDb();
  return db.collection<Investment>(INVESTMENTS_COLLECTION);
}

export async function createProject(projectData: NewProjectInput): Promise<{ success: boolean; message: string; }> {
    const projectsCollection = await getProjectsCollection();

    // Create a URL-friendly ID from the project name
    const id = projectData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const existingProject = await projectsCollection.findOne({ id });
    if (existingProject) {
        return { success: false, message: 'A project with this name already exists.' };
    }

    const newProject: Project = {
        id,
        ...projectData,
    };

    try {
        await projectsCollection.insertOne(newProject);
        return { success: true, message: 'Project created successfully.' };
    } catch (error) {
        console.error(`[${new Date().toISOString()}] [projectService] Error creating project ${id}:`, error);
        return { success: false, message: 'A database error occurred during project creation.' };
    }
}


export async function getAllProjects(): Promise<Project[]> {
    const projectsCollection = await getProjectsCollection();
    const projectsCursor = projectsCollection.find({});
    const projectsArray = await projectsCursor.toArray();
    
    if (projectsArray.length === 0) {
        // If no projects exist, create the default one and return it.
        const defaultProject = await getFeaturedProject();
        return [defaultProject];
    }
    
    return projectsArray.map(doc => {
        const { _id, ...project } = doc as WithId<Project>;
        return project as Project;
    });
}

export async function getProjectById(projectId: string): Promise<Project | null> {
    const projectsCollection = await getProjectsCollection();
    const projectDoc = await projectsCollection.findOne({ id: projectId });
    if (!projectDoc) {
        return null;
    }
    const { _id, ...project } = projectDoc as WithId<Project>;
    return project as Project;
}

export async function updateProject(projectId: string, projectData: NewProjectInput): Promise<{ success: boolean; message: string; }> {
    const projectsCollection = await getProjectsCollection();
    try {
        const result = await projectsCollection.updateOne({ id: projectId }, { $set: projectData });
        if (result.matchedCount === 0) {
            return { success: false, message: 'Project not found.' };
        }
        return { success: true, message: 'Project updated successfully.' };
    } catch (error) {
        console.error(`[${new Date().toISOString()}] [projectService] Error updating project ${projectId}:`, error);
        return { success: false, message: 'A database error occurred during project update.' };
    }
}

export async function deleteProject(projectId: string): Promise<{ success: boolean; message: string; }> {
    const projectsCollection = await getProjectsCollection();
    const investmentsCollection = await getInvestmentsCollection();

    try {
        const projectResult = await projectsCollection.deleteOne({ id: projectId });
        if (projectResult.deletedCount === 0) {
            return { success: false, message: 'Project not found.' };
        }
        
        // Also delete associated investments
        const investmentsResult = await investmentsCollection.deleteMany({ projectId });
        console.log(`[${new Date().toISOString()}] [projectService] Deleted project ${projectId} and ${investmentsResult.deletedCount} associated investments.`);

        return { success: true, message: `Project "${projectId}" and its investments have been deleted.` };
    } catch (error) {
        console.error(`[${new Date().toISOString()}] [projectService] Error deleting project ${projectId}:`, error);
        return { success: false, message: 'A database error occurred during deletion.' };
    }
}


export async function getFeaturedProject(): Promise<Project> {
    const projectsCollection = await getProjectsCollection();
    const projectId = 'project-chimera';
    let projectDoc = await projectsCollection.findOne({ id: projectId });

    if (!projectDoc) {
        console.log(`[${new Date().toISOString()}] [projectService] Featured project '${projectId}' not found, creating it...`);
        const defaultProject: Project = {
            id: projectId,
            name: 'Project Chimera',
            vision: 'While Binance Trailblazer is a powerful tool, I envision something far more advanced. Project Chimera will be a multi-strategy, AI-optimized trading system that adapts to market conditions in real-time. It requires significant resources for hosting, enterprise-grade data feeds, and dedicated AI model training. Your investment will directly fund this development.',
            goal: "To raise the necessary capital to build and deploy Project Chimera within a one-month timeframe. We're seeking a small group of founding backers who believe in this vision.",
            offer: "As a thank you, each of our 10 founding backers will receive a <strong class=\"text-foreground\">Lifetime Pro Plan</strong> for the new platform. No subscriptions, ever.",
            investorTarget: 10,
            investmentAmount: 150,
        };
        await projectsCollection.insertOne(defaultProject);
        projectDoc = defaultProject;
    }
    
    // Ensure we don't pass MongoDB's internal _id to the client
    const { _id, ...project } = projectDoc as WithId<Project>;
    return project as Project;
}

export async function getInvestmentCount(projectId: string): Promise<number> {
    const investmentsCollection = await getInvestmentsCollection();
    return await investmentsCollection.countDocuments({ projectId });
}

export async function hasUserInvested(projectId: string, userId: string): Promise<boolean> {
    const investmentsCollection = await getInvestmentsCollection();
    const count = await investmentsCollection.countDocuments({ projectId, userId });
    return count > 0;
}

export async function createInvestment(projectId: string, userId: string): Promise<{ success: boolean; message: string; }> {
    const investmentsCollection = await getInvestmentsCollection();
    const projectsCollection = await getProjectsCollection();

    const project = await projectsCollection.findOne({ id: projectId });
    if (!project) {
        return { success: false, message: 'Project not found.' };
    }

    const currentInvestors = await getInvestmentCount(projectId);
    if (currentInvestors >= project.investorTarget) {
        return { success: false, message: 'This project is already fully funded!' };
    }

    const alreadyInvested = await hasUserInvested(projectId, userId);
    if (alreadyInvested) {
        return { success: false, message: 'You have already invested in this project.' };
    }
    
    const newInvestment: Investment = {
        projectId,
        userId,
        timestamp: Date.now(),
    };

    try {
        await investmentsCollection.insertOne(newInvestment);
        return { success: true, message: 'Thank you for your investment!' };
    } catch (error) {
        console.error(`[${new Date().toISOString()}] [projectService] Failed to create investment for user ${userId} in project ${projectId}:`, error);
        return { success: false, message: 'A database error occurred. Please try again.' };
    }
}

export async function getInvestorsByProject(projectId: string): Promise<Investment[]> {
    const investmentsCollection = await getInvestmentsCollection();
    const investors = await investmentsCollection.find({ projectId }).sort({ timestamp: -1 }).toArray();
    
    // Remove MongoDB's internal _id before returning
    return investors.map(doc => {
        const { _id, ...investment } = doc as WithId<Investment>;
        return investment as Investment;
    });
}
