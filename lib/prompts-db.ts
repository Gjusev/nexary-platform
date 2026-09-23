import { query as dbQuery } from './db';
import type { Prompt, PromptVisibility } from './prompts-schema';

export class PromptsDB {
  /**
   * Get prompts accessible by a user
   * @param userId - The user ID
   * @param teamSlug - Optional team slug for team prompts
   * @param visibility - Filter by visibility level
   */
  static async getPrompts(
    userId: string,
    teamSlug?: string,
    visibility?: PromptVisibility
  ): Promise<Prompt[]> {
    let queryText = `
      SELECT 
        p.*,
        EXISTS(
          SELECT 1 FROM projectnexus.user_favorite_prompts ufp 
          WHERE ufp.prompt_id = p.id AND ufp.user_id = $1
        ) as is_favorite
      FROM projectnexus.prompts p
      WHERE 
    `;

    const conditions: string[] = [];
    const params: any[] = [userId];
    let paramIndex = 2;

    if (visibility) {
      conditions.push(`p.visibility = $${paramIndex}`);
      params.push(visibility);
      paramIndex++;

      if (visibility === 'private') {
        conditions.push(`p.user_id = $1`);
      } else if (visibility === 'team') {
        if (!teamSlug) {
          return [];
        }
        conditions.push(`p.team_slug = $${paramIndex}`);
        params.push(teamSlug);
        paramIndex++;
      }
    } else {
      // Get all accessible prompts
      const visibilityConditions = [
        `(p.visibility = 'private' AND p.user_id = $1)`,
        `(p.visibility = 'community')`,
      ];

      if (teamSlug) {
        visibilityConditions.push(
          `(p.visibility = 'team' AND p.team_slug = $${paramIndex})`
        );
        params.push(teamSlug);
        paramIndex++;
      }

      conditions.push(`(${visibilityConditions.join(' OR ')})`);
    }

    queryText += conditions.join(' AND ');
    queryText += ' ORDER BY p.created_at DESC';

    const result = await dbQuery(queryText, params);
    return result.rows;
  }

  /**
   * Create a new prompt
   */
  static async createPrompt(data: {
    title: string;
    content: string;
    description?: string;
    visibility: PromptVisibility;
    userId: string;
    username?: string;
    teamSlug?: string;
    category?: string;
    tags?: string[];
  }): Promise<Prompt> {
    const result = await dbQuery(
      `
      INSERT INTO projectnexus.prompts 
        (title, content, description, visibility, user_id, username, team_slug, category, tags)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [
        data.title,
        data.content,
        data.description,
        data.visibility,
        data.userId,
        data.username,
        data.teamSlug,
        data.category,
        data.tags || [],
      ]
    );

    return result.rows[0];
  }

  /**
   * Update a prompt
   */
  static async updatePrompt(
    promptId: string,
    userId: string,
    data: {
      title?: string;
      content?: string;
      description?: string;
      visibility?: PromptVisibility;
      teamSlug?: string;
      category?: string;
      tags?: string[];
    }
  ): Promise<Prompt | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      params.push(data.title);
      paramIndex++;
    }
    if (data.content !== undefined) {
      updates.push(`content = $${paramIndex}`);
      params.push(data.content);
      paramIndex++;
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(data.description);
      paramIndex++;
    }
    if (data.visibility !== undefined) {
      updates.push(`visibility = $${paramIndex}`);
      params.push(data.visibility);
      paramIndex++;
    }
    if (data.teamSlug !== undefined) {
      updates.push(`team_slug = $${paramIndex}`);
      params.push(data.teamSlug);
      paramIndex++;
    }
    if (data.category !== undefined) {
      updates.push(`category = $${paramIndex}`);
      params.push(data.category);
      paramIndex++;
    }
    if (data.tags !== undefined) {
      updates.push(`tags = $${paramIndex}`);
      params.push(data.tags);
      paramIndex++;
    }

    if (updates.length === 0) {
      return null;
    }

    updates.push(`updated_at = NOW()`);

    params.push(promptId, userId);

    const result = await dbQuery(
      `
      UPDATE projectnexus.prompts
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
      RETURNING *
      `,
      params
    );

    return result.rows[0] || null;
  }

  /**
   * Delete a prompt
   */
  static async deletePrompt(promptId: string, userId: string): Promise<boolean> {
    const result = await dbQuery(
      `DELETE FROM projectnexus.prompts WHERE id = $1 AND user_id = $2`,
      [promptId, userId]
    );

    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Toggle favorite status
   */
  static async toggleFavorite(
    promptId: string,
    userId: string
  ): Promise<{ isFavorite: boolean }> {
    // Check if already favorited
    const check = await dbQuery(
      `SELECT id FROM projectnexus.user_favorite_prompts WHERE user_id = $1 AND prompt_id = $2`,
      [userId, promptId]
    );

    if (check.rows.length > 0) {
      // Remove favorite
      await dbQuery(
        `DELETE FROM projectnexus.user_favorite_prompts WHERE user_id = $1 AND prompt_id = $2`,
        [userId, promptId]
      );
      
      // Decrement favorite count
      await dbQuery(
        `UPDATE projectnexus.prompts SET favorite_count = GREATEST(favorite_count - 1, 0) WHERE id = $1`,
        [promptId]
      );

      return { isFavorite: false };
    } else {
      // Add favorite
      await dbQuery(
        `INSERT INTO projectnexus.user_favorite_prompts (user_id, prompt_id) VALUES ($1, $2)`,
        [userId, promptId]
      );
      
      // Increment favorite count
      await dbQuery(
        `UPDATE projectnexus.prompts SET favorite_count = favorite_count + 1 WHERE id = $1`,
        [promptId]
      );

      return { isFavorite: true };
    }
  }

  /**
   * Increment usage count
   */
  static async incrementUsage(promptId: string): Promise<void> {
    await dbQuery(
      `UPDATE projectnexus.prompts SET usage_count = usage_count + 1 WHERE id = $1`,
      [promptId]
    );
  }

  /**
   * Search prompts
   */
  static async searchPrompts(
    userId: string,
    searchQuery: string,
    teamSlug?: string,
    visibility?: PromptVisibility
  ): Promise<Prompt[]> {
    const params: any[] = [userId, `%${searchQuery}%`];
    let paramIndex = 3;

    let queryText = `
      SELECT 
        p.*,
        EXISTS(
          SELECT 1 FROM projectnexus.user_favorite_prompts ufp 
          WHERE ufp.prompt_id = p.id AND ufp.user_id = $1
        ) as is_favorite
      FROM projectnexus.prompts p
      WHERE (
        p.title ILIKE $2 OR 
        p.content ILIKE $2 OR 
        p.description ILIKE $2 OR
        $2 = ANY(p.tags)
      )
      AND (
    `;

    if (visibility) {
      const restrictedConditions: string[] = [`p.visibility = $${paramIndex}`];
      params.push(visibility);
      paramIndex++;

      if (visibility === 'private') {
        restrictedConditions.push(`p.user_id = $1`);
      } else if (visibility === 'team') {
        if (!teamSlug) {
          return [];
        }
        restrictedConditions.push(`p.team_slug = $${paramIndex}`);
        params.push(teamSlug);
        paramIndex++;
      }

      queryText += restrictedConditions.join(' AND ');
    } else {
      const visibilityConditions: string[] = [];
      visibilityConditions.push(`(p.visibility = 'private' AND p.user_id = $1)`);
      visibilityConditions.push(`(p.visibility = 'community')`);

      if (teamSlug) {
        visibilityConditions.push(`(p.visibility = 'team' AND p.team_slug = $${paramIndex})`);
        params.push(teamSlug);
        paramIndex++;
      }

      queryText += visibilityConditions.join(' OR ');
    }

    queryText += ') ORDER BY p.usage_count DESC, p.favorite_count DESC, p.created_at DESC';

    const result = await dbQuery(queryText, params);
    return result.rows;
  }
}
