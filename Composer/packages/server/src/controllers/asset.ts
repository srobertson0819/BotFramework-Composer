/* eslint-disable @typescript-eslint/no-var-requires */
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BotTemplateV2, FeedType } from '@bfc/shared';
// import { request } from 'request';

import AssetService from '../services/asset';
import { getNpmTemplates } from '../utility/npm';
import { getNugetTemplates } from '../utility/nuget';

const request = require('request'); // If server-side node code.
const through = require('through');
const trumpet = require('trumpet');

async function getProjTemplates(req: any, res: any) {
  try {
    const templates = await AssetService.manager.getProjectTemplates();
    res.status(200).json(templates);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : error,
    });
  }
}

export function getFeedType(data: any): FeedType {
  // TODO: parse through data to detect for npm or nuget package schema and return respecive result
  return 'npm';
}

export async function getFeedContents(feedUrl: string): Promise<BotTemplateV2[] | undefined | null> {
  try {
    const res = await fetch(feedUrl);
    const data = await res.json();
    const feedType = getFeedType(data);
    if (feedType === 'npm') {
      return data.objects.map((result) => {
        const { name, version, description = '', keywords = [] } = result.package;

        return {
          id: name,
          name: name,
          description: description,
          keywords: keywords,
          package: {
            packageName: name,
            packageSource: 'npm',
            packageVersion: version,
          },
        } as BotTemplateV2;
      });
    } else if (feedType === 'nuget') {
      // TODO: handle nuget processing
    } else {
      return [];
    }
  } catch (error) {
    return null;
  }
}

export async function getCustomFeedTemplates(feedUrls: string[]): Promise<BotTemplateV2[]> {
  let templates: BotTemplateV2[] = [];
  const invalidFeedUrls: string[] = [];

  for (const feed of feedUrls) {
    const feedTemplates = await getFeedContents(feed);
    if (feedTemplates === null) {
      invalidFeedUrls.push(feed);
    } else if (feedTemplates && Array.isArray(feedTemplates) && feedTemplates.length > 0) {
      templates = templates.concat(feedTemplates);
    }
  }

  return templates;
}

export async function getProjTemplatesV2(req: any, res: any) {
  try {
    let templates: BotTemplateV2[] = [];

    // Get FeedUrl
    const { feedUrls, getFirstPartyNuget, getFirstPartyNpm } = req.body;

    // Grab templates from FeedURls
    if (feedUrls) {
      // TODO: Current assumption is that the feed is an npm feed with given result structure (https://registry.npmjs.org/-/v1/search?text=docker&size=100&from=0&quality=0.65&popularity=0.98&maintenance=0.5)
      const feedTemplates = await getCustomFeedTemplates(feedUrls);
      templates = templates.concat(feedTemplates);
    }

    if (getFirstPartyNpm) {
      // Grab templates from public npm
      templates = templates.concat(await getNpmTemplates());
    }
    if (getFirstPartyNuget) {
      // Grab templates from public NuGet
      templates = templates.concat(await getNugetTemplates());
    }

    // return templates
    res.status(200).json(templates);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : error,
    });
  }
}

export async function getTemplateReadMe(req: any, res: any) {
  try {
    // Get FeedUrl
    // let readMe = '';
    const { moduleName } = req.body;
    const tr = trumpet();

    const moduleURL = 'http://npmjs.org/' + moduleName;
    const npmReq = request(moduleURL).pipe(tr);

    let readme = '';
    npmReq
      .pipe(
        through(
          (data) => {
            readme += data.toString();
          },
          () => {
            // readmeCache[module] = readme;
            // callback(null, readme);
            // readMe = readme;
            res.status(200).json(readme);
          }
        )
      )
      .on('error', () => {
        console.log('error');
      });
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : error,
    });
  }
}

export const AssetController = {
  getProjTemplates: getProjTemplates,
  getProjTemplatesV2: getProjTemplatesV2,
  getTemplateReadMe: getTemplateReadMe,
};
