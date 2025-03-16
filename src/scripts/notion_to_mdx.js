const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
// require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

console.log('Notion API Key:', process.env.NOTION_API_KEY);
console.log('Notion Database ID:', process.env.NOTION_DATABASE_ID);

// Notion 클라이언트 초기화
const notion = new Client({ auth: process.env.NOTION_API_KEY });

// Notion 데이터베이스 ID
const databaseId = process.env.NOTION_DATABASE_ID;

// 슬러그 생성 함수 (라이브러리 없이 직접 구현)
function createSlug(title) {
    return title
        .toLowerCase()
        .trim()
        .replace(/[\s_-]+/g, '-') // 공백, 밑줄, 하이픈을 하나의 하이픈으로 변환
        .replace(/^-+|-+$/g, ''); // 앞뒤 하이픈 제거
}

// Notion 페이지 본문 가져오기
async function getPageContent(pageId) {
    const response = await notion.blocks.children.list({ block_id: pageId });
    return response.results.map(block => processBlock(block)).join('\n\n');
}

// 블록을 MDX 형식으로 변환하는 함수
function processBlock(block) {
    if (block.type === 'paragraph') {
        return block.paragraph.rich_text.map(text => text.plain_text).join('');
    }
    if (block.type === 'heading_1') {
        return `# ${block.heading_1.rich_text.map(text => text.plain_text).join('')}`;
    }
    if (block.type === 'heading_2') {
        return `## ${block.heading_2.rich_text.map(text => text.plain_text).join('')}`;
    }
    if (block.type === 'heading_3') {
        return `### ${block.heading_3.rich_text.map(text => text.plain_text).join('')}`;
    }
    if (block.type === 'bulleted_list_item') {
        return `- ${block.bulleted_list_item.rich_text.map(text => text.plain_text).join('')}`;
    }
    if (block.type === 'numbered_list_item') {
        return `1. ${block.numbered_list_item.rich_text.map(text => text.plain_text).join('')}`;
    }
    if (block.type === 'quote') {
        return `> ${block.quote.rich_text.map(text => text.plain_text).join('')}`;
    }
    if (block.type === 'code') {
        const lang = block.code.language || 'plaintext';
        const codeText = block.code.rich_text.map(text => text.plain_text).join('');
        return `\`\`\`${lang}\n${codeText}\n\`\`\``;
    }
    return '';
}

// MDX 파일 생성 함수
const createMdxFile = async (post) => {
    const titleProperty = post.properties['이름'] || post.properties['Name']; // 한글/영어 둘 다 지원
    const title = titleProperty?.title?.[0]?.plain_text || `Untitled-${Date.now()}`;;
    const slug = createSlug(title);
    const folderName = post.properties?.folder_name?.rich_text[0]?.text.content || `Untitled-${Date.now()}`;
    const date = post.properties.Date?.date?.start || new Date().toISOString().split('T')[0];

    // Notion 페이지 본문 가져오기
    const content = await getPageContent(post.id);

    // MDX 파일 내용 구성
    const mdxContent = `---
title: "${title}"
date: "${date}"
slug: "${slug}"
---

${content}
`;

    const dirPath = path.join(__dirname, '..', '..', 'content', 'blog', folderName);
    const filePath = path.join(dirPath, 'index.md');

    fs.mkdirSync(dirPath, { recursive: true });
    fs.writeFileSync(filePath, mdxContent, 'utf8');
};

// Notion 데이터베이스에서 게시물 가져오기
const fetchNotionPosts = async () => {
    const response = await notion.databases.query({ database_id: databaseId });
    for (const post of response.results) {
        await createMdxFile(post);
    }
};

// 스크립트 실행
fetchNotionPosts().catch(console.error);
