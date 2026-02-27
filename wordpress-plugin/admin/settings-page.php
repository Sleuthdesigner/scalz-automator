<?php
/**
 * Admin Settings Page Template
 *
 * Rendered by Scalz_Settings::render_settings_page().
 * Provides the full admin UI for configuring:
 *   - API key management
 *   - AI provider & credentials
 *   - Master prompt templates
 *
 * @package ScalzSEOAutomator
 * @since   1.0.0
 */

// Prevent direct access.
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

if ( ! current_user_can( 'manage_options' ) ) {
    return;
}

// Fetch current values.
$api_key     = get_option( 'scalz_seo_api_key', '' );
$provider    = get_option( 'scalz_seo_ai_provider', 'openai' );
$openai_key  = get_option( 'scalz_seo_openai_api_key', '' );
$model       = get_option( 'scalz_seo_openai_model', 'gpt-4o' );
$temperature = (float) get_option( 'scalz_seo_ai_temperature', 0.7 );

// White-label settings.
$wl_defaults = [
    'agency_name'   => 'SEO Automator',
    'agency_url'    => '',
    'plugin_name'   => 'SEO Automator',
    'menu_icon'     => 'dashicons-chart-area',
    'hide_branding' => false,
];
$wl = wp_parse_args( get_option( 'scalz_seo_white_label', [] ), $wl_defaults );

// Active tab.
$active_tab = isset( $_GET['tab'] ) ? sanitize_key( $_GET['tab'] ) : 'general';

$prompt_page_title       = get_option( 'scalz_seo_prompt_page_title',       '{service} in {city}, {state_abbr} | {business_name}' );
$prompt_meta_description = get_option( 'scalz_seo_prompt_meta_description',  'Write a compelling 155-character SEO meta description for a page titled "{title}" about {service} in {location}. Include a call to action. Output only the meta description, no quotes.' );
$prompt_acf_content      = get_option( 'scalz_seo_prompt_acf_content',       'Write SEO and AEO optimized HTML content for a {niche} business page targeting the keyword "{focus_keyword}" in {location}. Business name: {business_name}. Phone: {phone}. Include relevant H2 subheadings, a brief intro, service benefits, and a FAQ section. Format in clean HTML with <h2>, <p>, and <ul> tags.' );
$prompt_blog_title       = get_option( 'scalz_seo_prompt_blog_title',        'Generate {count} unique blog post titles for a {niche} business in {city}, {state}. Business name: {business_name}. Titles must be SEO-friendly and not duplicate:\n{existing_titles}\nReturn only a JSON array of strings.' );
$prompt_blog_content     = get_option( 'scalz_seo_prompt_blog_content',      'Write a comprehensive, SEO and AEO optimized blog post about "{title}" for {business_name} in {city}, {state}. Primary keyword: {focus_keyword}. Include an engaging introduction, multiple H2 subheadings, actionable advice, local relevance, a FAQ section with 3-5 questions, and a strong conclusion with CTA. Target 1500-2000 words. Format in clean HTML.' );
$prompt_faq              = get_option( 'scalz_seo_prompt_faq',               'Generate 5 FAQ questions and detailed answers about {service} in {location} for {business_name}. Make answers comprehensive (2-3 sentences each) and naturally include the service and location. Format as JSON array: [{"question": "...", "answer": "..."}]' );
$prompt_alt_tag          = get_option( 'scalz_seo_prompt_alt_tag',           'Generate a descriptive, SEO-friendly alt tag for an image on a {service} page for {business_name} in {city}, {state_abbr}. Be specific and include the service and location naturally. Output only the alt tag text, no quotes.' );
?>
<div class="wrap scalz-settings-wrap">

    <h1><?php echo esc_html( $wl['plugin_name'] ); ?> &mdash; <?php esc_html_e( 'Settings', 'scalz-seo-automator' ); ?></h1>

    <?php settings_errors( 'scalz_seo_settings' ); ?>

    <!-- Tab Navigation -->
    <nav class="nav-tab-wrapper">
        <a href="?page=scalz-seo-automator&tab=general"
           class="nav-tab <?php echo $active_tab === 'general' ? 'nav-tab-active' : ''; ?>">
            <?php esc_html_e( 'General', 'scalz-seo-automator' ); ?>
        </a>
        <a href="?page=scalz-seo-automator&tab=ai"
           class="nav-tab <?php echo $active_tab === 'ai' ? 'nav-tab-active' : ''; ?>">
            <?php esc_html_e( 'AI Settings', 'scalz-seo-automator' ); ?>
        </a>
        <a href="?page=scalz-seo-automator&tab=prompts"
           class="nav-tab <?php echo $active_tab === 'prompts' ? 'nav-tab-active' : ''; ?>">
            <?php esc_html_e( 'Prompts', 'scalz-seo-automator' ); ?>
        </a>
        <a href="?page=scalz-seo-automator&tab=white-label"
           class="nav-tab <?php echo $active_tab === 'white-label' ? 'nav-tab-active' : ''; ?>">
            <?php esc_html_e( 'White Label', 'scalz-seo-automator' ); ?>
        </a>
    </nav>

    <form method="post" action="options.php">
        <?php
        if ( $active_tab === 'general' ) :
            settings_fields( 'scalz_seo_general_settings' );
            do_settings_sections( 'scalz_seo_general_settings' );
        elseif ( $active_tab === 'ai' ) :
            settings_fields( 'scalz_seo_ai_settings' );
            do_settings_sections( 'scalz_seo_ai_settings' );
        elseif ( $active_tab === 'prompts' ) :
            settings_fields( 'scalz_seo_prompt_settings' );
            do_settings_sections( 'scalz_seo_prompt_settings' );
        elseif ( $active_tab === 'white-label' ) :
            settings_fields( 'scalz_seo_white_label_settings' );
            do_settings_sections( 'scalz_seo_white_label_settings' );
        endif;
        ?>

        <!-- GENERAL TAB -->
        <?php if ( $active_tab === 'general' ) : ?>
        <table class="form-table" role="presentation">
            <tr>
                <th scope="row">
                    <label for="scalz_seo_api_key"><?php esc_html_e( 'API Key', 'scalz-seo-automator' ); ?></label>
                </th>
                <td>
                    <input type="text" id="scalz_seo_api_key" name="scalz_seo_api_key"
                           value="<?php echo esc_attr( $api_key ); ?>"
                           class="regular-text code" readonly />
                    <p class="description">
                        <?php esc_html_e( 'Auto-generated API key. Use this in the dashboard to connect this site.', 'scalz-seo-automator' ); ?>
                    </p>
                </td>
            </tr>
        </table>
        <?php endif; ?>

        <!-- AI SETTINGS TAB -->
        <?php if ( $active_tab === 'ai' ) : ?>
        <table class="form-table" role="presentation">
            <tr>
                <th scope="row"><?php esc_html_e( 'AI Provider', 'scalz-seo-automator' ); ?></th>
                <td>
                    <fieldset>
                        <label>
                            <input type="radio" name="scalz_seo_ai_provider" value="openai"
                                <?php checked( $provider, 'openai' ); ?> />
                            <?php esc_html_e( 'OpenAI API', 'scalz-seo-automator' ); ?>
                        </label><br />
                        <label>
                            <input type="radio" name="scalz_seo_ai_provider" value="ai-engine"
                                <?php checked( $provider, 'ai-engine' ); ?> />
                            <?php esc_html_e( 'AI Engine (Meow Apps)', 'scalz-seo-automator' ); ?>
                        </label>
                    </fieldset>
                    <p class="description">
                        <?php esc_html_e( 'Select the AI provider to use for content generation.', 'scalz-seo-automator' ); ?>
                    </p>
                </td>
            </tr>

            <tr id="openai-settings" <?php echo $provider !== 'openai' ? 'style="display:none"' : ''; ?>>
                <th scope="row">
                    <label for="scalz_seo_openai_api_key"><?php esc_html_e( 'OpenAI API Key', 'scalz-seo-automator' ); ?></label>
                </th>
                <td>
                    <input type="password" id="scalz_seo_openai_api_key" name="scalz_seo_openai_api_key"
                           value="<?php echo esc_attr( $openai_key ); ?>"
                           class="regular-text" autocomplete="new-password" />
                    <p class="description">
                        <?php esc_html_e( 'Your OpenAI API key. Starts with sk-.', 'scalz-seo-automator' ); ?>
                    </p>
                </td>
            </tr>

            <tr id="openai-model" <?php echo $provider !== 'openai' ? 'style="display:none"' : ''; ?>>
                <th scope="row">
                    <label for="scalz_seo_openai_model"><?php esc_html_e( 'Model', 'scalz-seo-automator' ); ?></label>
                </th>
                <td>
                    <select id="scalz_seo_openai_model" name="scalz_seo_openai_model">
                        <option value="gpt-4o" <?php selected( $model, 'gpt-4o' ); ?>>GPT-4o</option>
                        <option value="gpt-4o-mini" <?php selected( $model, 'gpt-4o-mini' ); ?>>GPT-4o Mini</option>
                        <option value="gpt-4-turbo" <?php selected( $model, 'gpt-4-turbo' ); ?>>GPT-4 Turbo</option>
                        <option value="gpt-3.5-turbo" <?php selected( $model, 'gpt-3.5-turbo' ); ?>>GPT-3.5 Turbo</option>
                    </select>
                    <p class="description">
                        <?php esc_html_e( 'OpenAI model to use for generation.', 'scalz-seo-automator' ); ?>
                    </p>
                </td>
            </tr>

            <tr>
                <th scope="row">
                    <label for="scalz_seo_ai_temperature"><?php esc_html_e( 'Temperature', 'scalz-seo-automator' ); ?></label>
                </th>
                <td>
                    <input type="number" id="scalz_seo_ai_temperature" name="scalz_seo_ai_temperature"
                           value="<?php echo esc_attr( $temperature ); ?>"
                           min="0" max="2" step="0.1" class="small-text" />
                    <p class="description"><?php esc_html_e( '0 = deterministic, 2 = very creative. Recommended: 0.7', 'scalz-seo-automator' ); ?></p>
                </td>
            </tr>
        </table>

        <script>
        document.addEventListener('DOMContentLoaded', function () {
            var radios = document.querySelectorAll('input[name="scalz_seo_ai_provider"]');
            var openaiRows = document.querySelectorAll('#openai-settings, #openai-model');
            radios.forEach(function (radio) {
                radio.addEventListener('change', function () {
                    openaiRows.forEach(function (row) {
                        row.style.display = radio.value === 'openai' ? '' : 'none';
                    });
                });
            });
        });
        </script>
        <?php endif; ?>

        <!-- PROMPTS TAB -->
        <?php if ( $active_tab === 'prompts' ) : ?>
        <table class="form-table" role="presentation">
            <tr>
                <th scope="row">
                    <label for="scalz_seo_prompt_page_title"><?php esc_html_e( 'Page Title Template', 'scalz-seo-automator' ); ?></label>
                </th>
                <td>
                    <input type="text" id="scalz_seo_prompt_page_title" name="scalz_seo_prompt_page_title"
                           value="<?php echo esc_attr( $prompt_page_title ); ?>"
                           class="large-text" />
                    <p class="description"><?php esc_html_e( 'Variables: {service}, {city}, {state_abbr}, {business_name}', 'scalz-seo-automator' ); ?></p>
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label for="scalz_seo_prompt_meta_description"><?php esc_html_e( 'Meta Description Prompt', 'scalz-seo-automator' ); ?></label>
                </th>
                <td>
                    <textarea id="scalz_seo_prompt_meta_description" name="scalz_seo_prompt_meta_description"
                              rows="3" class="large-text"><?php echo esc_textarea( $prompt_meta_description ); ?></textarea>
                    <p class="description"><?php esc_html_e( 'Variables: {title}, {service}, {location}', 'scalz-seo-automator' ); ?></p>
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label for="scalz_seo_prompt_acf_content"><?php esc_html_e( 'ACF Content Prompt', 'scalz-seo-automator' ); ?></label>
                </th>
                <td>
                    <textarea id="scalz_seo_prompt_acf_content" name="scalz_seo_prompt_acf_content"
                              rows="5" class="large-text"><?php echo esc_textarea( $prompt_acf_content ); ?></textarea>
                    <p class="description"><?php esc_html_e( 'Variables: {niche}, {focus_keyword}, {location}, {business_name}, {phone}', 'scalz-seo-automator' ); ?></p>
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label for="scalz_seo_prompt_blog_title"><?php esc_html_e( 'Blog Title Prompt', 'scalz-seo-automator' ); ?></label>
                </th>
                <td>
                    <textarea id="scalz_seo_prompt_blog_title" name="scalz_seo_prompt_blog_title"
                              rows="4" class="large-text"><?php echo esc_textarea( $prompt_blog_title ); ?></textarea>
                    <p class="description"><?php esc_html_e( 'Variables: {count}, {niche}, {city}, {state}, {business_name}, {existing_titles}', 'scalz-seo-automator' ); ?></p>
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label for="scalz_seo_prompt_blog_content"><?php esc_html_e( 'Blog Content Prompt', 'scalz-seo-automator' ); ?></label>
                </th>
                <td>
                    <textarea id="scalz_seo_prompt_blog_content" name="scalz_seo_prompt_blog_content"
                              rows="5" class="large-text"><?php echo esc_textarea( $prompt_blog_content ); ?></textarea>
                    <p class="description"><?php esc_html_e( 'Variables: {title}, {business_name}, {city}, {state}, {focus_keyword}', 'scalz-seo-automator' ); ?></p>
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label for="scalz_seo_prompt_faq"><?php esc_html_e( 'FAQ Schema Prompt', 'scalz-seo-automator' ); ?></label>
                </th>
                <td>
                    <textarea id="scalz_seo_prompt_faq" name="scalz_seo_prompt_faq"
                              rows="4" class="large-text"><?php echo esc_textarea( $prompt_faq ); ?></textarea>
                    <p class="description"><?php esc_html_e( 'Variables: {service}, {location}, {business_name}', 'scalz-seo-automator' ); ?></p>
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label for="scalz_seo_prompt_alt_tag"><?php esc_html_e( 'Alt Tag Prompt', 'scalz-seo-automator' ); ?></label>
                </th>
                <td>
                    <textarea id="scalz_seo_prompt_alt_tag" name="scalz_seo_prompt_alt_tag"
                              rows="3" class="large-text"><?php echo esc_textarea( $prompt_alt_tag ); ?></textarea>
                    <p class="description"><?php esc_html_e( 'Variables: {service}, {city}, {state_abbr}, {business_name}', 'scalz-seo-automator' ); ?></p>
                </td>
            </tr>
        </table>
        <?php endif; ?>

        <!-- WHITE LABEL TAB -->
        <?php if ( $active_tab === 'white-label' ) : ?>
        <table class="form-table" role="presentation">
            <tr>
                <th scope="row">
                    <label for="wl_agency_name"><?php esc_html_e( 'Agency Name', 'scalz-seo-automator' ); ?></label>
                </th>
                <td>
                    <input type="text" id="wl_agency_name" name="scalz_seo_white_label[agency_name]"
                           value="<?php echo esc_attr( $wl['agency_name'] ); ?>" class="regular-text" />
                    <p class="description"><?php esc_html_e( 'Displayed in the plugin header.', 'scalz-seo-automator' ); ?></p>
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label for="wl_agency_url"><?php esc_html_e( 'Agency Website', 'scalz-seo-automator' ); ?></label>
                </th>
                <td>
                    <input type="url" id="wl_agency_url" name="scalz_seo_white_label[agency_url]"
                           value="<?php echo esc_attr( $wl['agency_url'] ); ?>" class="regular-text" />
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label for="wl_plugin_name"><?php esc_html_e( 'Plugin Display Name', 'scalz-seo-automator' ); ?></label>
                </th>
                <td>
                    <input type="text" id="wl_plugin_name" name="scalz_seo_white_label[plugin_name]"
                           value="<?php echo esc_attr( $wl['plugin_name'] ); ?>" class="regular-text" />
                    <p class="description"><?php esc_html_e( 'Shown in the WP admin menu and page titles.', 'scalz-seo-automator' ); ?></p>
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label for="wl_menu_icon"><?php esc_html_e( 'Admin Menu Icon', 'scalz-seo-automator' ); ?></label>
                </th>
                <td>
                    <input type="text" id="wl_menu_icon" name="scalz_seo_white_label[menu_icon]"
                           value="<?php echo esc_attr( $wl['menu_icon'] ); ?>" class="regular-text" />
                    <p class="description">
                        <?php esc_html_e( 'Dashicons class, e.g. dashicons-chart-area. See', 'scalz-seo-automator' ); ?>
                        <a href="https://developer.wordpress.org/resource/dashicons/" target="_blank">developer.wordpress.org/resource/dashicons</a>.
                    </p>
                </td>
            </tr>
            <tr>
                <th scope="row"><?php esc_html_e( 'Hide Branding', 'scalz-seo-automator' ); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="scalz_seo_white_label[hide_branding]"
                               value="1" <?php checked( ! empty( $wl['hide_branding'] ) ); ?> />
                        <?php esc_html_e( 'Hide "Powered by Scalz" footer in settings page', 'scalz-seo-automator' ); ?>
                    </label>
                </td>
            </tr>
        </table>
        <?php endif; ?>

        <?php submit_button(); ?>
    </form>

    <?php if ( empty( $wl['hide_branding'] ) ) : ?>
    <p style="color: #aaa; font-size: 11px; margin-top: 20px;">
        Powered by <a href="https://scalz.ai" target="_blank" style="color: #aaa;">Scalz SEO Automator</a>
    </p>
    <?php endif; ?>

</div><!-- .wrap -->