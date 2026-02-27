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

// ── Fetch options ──────────────────────────────────────────────────────────────
$api_key     = get_option( 'scalz_seo_api_key', '' );
$provider    = get_option( 'scalz_seo_ai_provider', 'openai' );
$openai_key  = get_option( 'scalz_seo_openai_api_key', '' );
$model       = get_option( 'scalz_seo_openai_model', 'gpt-4o' );
$temperature = (float) get_option( 'scalz_seo_ai_temperature', 0.7 );

// White-label settings.
$wl_defaults = [
    'agency_name'    => 'SEO Automator',
    'agency_url'     => '',
    'plugin_name'    => 'SEO Automator',
    'menu_icon'      => 'dashicons-chart-area',
    'hide_branding'  => false,
    'hide_wl_tab'    => false,
];
$wl = wp_parse_args( get_option( 'scalz_seo_white_label', [] ), $wl_defaults );

// Prompt templates.
$prompt_page_title       = get_option( 'scalz_seo_prompt_page_title',       '{service} in {city}, {state_abbr} | {business_name}' );
$prompt_meta_description = get_option( 'scalz_seo_prompt_meta_description',  'Write a compelling 155-character SEO meta description for a page titled "{title}" about {service} in {location}. Include a call to action. Output only the meta description, no quotes.' );
$prompt_acf_content      = get_option( 'scalz_seo_prompt_acf_content',       'Write SEO and AEO optimized HTML content for a {niche} business page targeting the keyword "{focus_keyword}" in {location}. Business name: {business_name}. Phone: {phone}. Include relevant H2 subheadings, a brief intro, service benefits, and a FAQ section. Format in clean HTML with <h2>, <p>, and <ul> tags.' );
$prompt_blog_title       = get_option( 'scalz_seo_prompt_blog_title',        'Generate {count} unique blog post titles for a {niche} business in {city}, {state}. Business name: {business_name}. Titles must be SEO-friendly and not duplicate:\n{existing_titles}\nReturn only a JSON array of strings.' );
$prompt_blog_content     = get_option( 'scalz_seo_prompt_blog_content',      'Write a comprehensive, SEO and AEO optimized blog post about "{title}" for {business_name} in {city}, {state}. Primary keyword: {focus_keyword}. Include an engaging introduction, multiple H2 subheadings, actionable advice, local relevance, a FAQ section with 3-5 questions, and a strong conclusion with CTA. Target 1500-2000 words. Format in clean HTML.' );
$prompt_faq              = get_option( 'scalz_seo_prompt_faq',               'Generate 5 FAQ questions and detailed answers about {service} in {location} for {business_name}. Make answers comprehensive (2-3 sentences each) and naturally include the service and location. Format as JSON array: [{"question": "...", "answer": "..."}]' );
$prompt_alt_tag          = get_option( 'scalz_seo_prompt_alt_tag',           'Generate a descriptive, SEO-friendly alt tag for an image on a {service} page for {business_name} in {city}, {state_abbr}. Be specific and include the service and location naturally. Output only the alt tag text, no quotes.' );

// Active tab.
$active_tab = isset( $_GET['tab'] ) ? sanitize_key( $_GET['tab'] ) : 'general';

// Was the form just saved?
$saved = isset( $_GET['settings-updated'] ) && 'true' === $_GET['settings-updated'];

// ── API Endpoint Reference ─────────────────────────────────────────────────────
$endpoints = [
    [ 'method' => 'GET',  'path' => '/status',                  'description' => __( 'Plugin health check & version info', 'scalz-seo-automator' ) ],
    [ 'method' => 'GET',  'path' => '/settings',                'description' => __( 'Get plugin settings', 'scalz-seo-automator' ) ],
    [ 'method' => 'POST', 'path' => '/settings',                'description' => __( 'Update plugin settings', 'scalz-seo-automator' ) ],
    [ 'method' => 'GET',  'path' => '/seo/titles',              'description' => __( 'Get page titles', 'scalz-seo-automator' ) ],
    [ 'method' => 'POST', 'path' => '/seo/titles',              'description' => __( 'Generate & save AI page titles', 'scalz-seo-automator' ) ],
    [ 'method' => 'GET',  'path' => '/seo/descriptions',        'description' => __( 'Get meta descriptions', 'scalz-seo-automator' ) ],
    [ 'method' => 'POST', 'path' => '/seo/descriptions',        'description' => __( 'Generate & save meta descriptions', 'scalz-seo-automator' ) ],
    [ 'method' => 'GET',  'path' => '/seo/focus-keywords',      'description' => __( 'Get focus keywords', 'scalz-seo-automator' ) ],
    [ 'method' => 'POST', 'path' => '/seo/focus-keywords',      'description' => __( 'Set focus keywords', 'scalz-seo-automator' ) ],
    [ 'method' => 'POST', 'path' => '/content/acf',             'description' => __( 'Generate & update ACF WYSIWYG content', 'scalz-seo-automator' ) ],
    [ 'method' => 'POST', 'path' => '/content/h2',              'description' => __( 'Generate & inject H2 headings', 'scalz-seo-automator' ) ],
    [ 'method' => 'POST', 'path' => '/blog/generate',           'description' => __( 'Generate a single blog post', 'scalz-seo-automator' ) ],
    [ 'method' => 'POST', 'path' => '/blog/batch',              'description' => __( 'Batch-generate blog posts from topic list', 'scalz-seo-automator' ) ],
    [ 'method' => 'POST', 'path' => '/schema/faq',              'description' => __( 'Generate & inject FAQ schema markup', 'scalz-seo-automator' ) ],
    [ 'method' => 'POST', 'path' => '/sitemap/parse',           'description' => __( 'Parse sitemap XML & return page inventory', 'scalz-seo-automator' ) ],
    [ 'method' => 'GET',  'path' => '/linking/suggestions',     'description' => __( 'Get linking suggestions for a page', 'scalz-seo-automator' ) ],
    [ 'method' => 'GET',  'path' => '/linking/report',          'description' => __( 'Full site-wide linking report', 'scalz-seo-automator' ) ],
    [ 'method' => 'GET',  'path' => '/linking/orphans',         'description' => __( 'List orphaned pages', 'scalz-seo-automator' ) ],
    [ 'method' => 'POST', 'path' => '/linking/apply',           'description' => __( 'Apply link suggestions to pages', 'scalz-seo-automator' ) ],
    [ 'method' => 'POST', 'path' => '/linking/auto',            'description' => __( 'Run auto-linking across entire site', 'scalz-seo-automator' ) ],
    [ 'method' => 'POST', 'path' => '/linking/index',           'description' => __( 'Re-index site content for linking analysis', 'scalz-seo-automator' ) ],
    [ 'method' => 'GET',  'path' => '/linking/config',          'description' => __( 'Get linking engine configuration', 'scalz-seo-automator' ) ],
    [ 'method' => 'PUT',  'path' => '/linking/config',          'description' => __( 'Update linking engine configuration', 'scalz-seo-automator' ) ],
    [ 'method' => 'GET',  'path' => '/seo/alt-tags',            'description' => __( 'Get image alt tags', 'scalz-seo-automator' ) ],
    [ 'method' => 'POST', 'path' => '/seo/alt-tags',            'description' => __( 'Generate & apply alt tags', 'scalz-seo-automator' ) ],
    [ 'method' => 'POST', 'path' => '/plugins/install',         'description' => __( 'Auto-install a dependency plugin', 'scalz-seo-automator' ) ],
];
?>
<div class="wrap scalz-settings-wrap">

    <!-- Header -->
    <div class="scalz-settings-hero">
        <h1 class="scalz-settings-title">
            <?php echo esc_html( $wl['plugin_name'] ); ?>
        </h1>
        <p class="scalz-settings-subtitle">
            <?php esc_html_e( 'Companion plugin for the Scalz AI dashboard. Configure your API key, AI provider, and master prompt templates below.', 'scalz-seo-automator' ); ?>
        </p>
    </div>

    <!-- Tab Navigation -->
    <nav class="nav-tab-wrapper scalz-tab-nav">
        <a href="<?php echo esc_url( add_query_arg( [ 'page' => 'scalz-seo-automator', 'tab' => 'general' ], admin_url( 'admin.php' ) ) ); ?>"
           class="nav-tab <?php echo 'general' === $active_tab ? 'nav-tab-active' : ''; ?>">
            <?php esc_html_e( 'General', 'scalz-seo-automator' ); ?>
        </a>
        <a href="<?php echo esc_url( add_query_arg( [ 'page' => 'scalz-seo-automator', 'tab' => 'white_label' ], admin_url( 'admin.php' ) ) ); ?>"
           class="nav-tab <?php echo 'white_label' === $active_tab ? 'nav-tab-active' : ''; ?>">
            <?php esc_html_e( 'White Label', 'scalz-seo-automator' ); ?>
        </a>
    </nav>

    <?php if ( $saved ) : ?>
        <div class="notice notice-success is-dismissible">
            <p><?php esc_html_e( 'Settings saved successfully.', 'scalz-seo-automator' ); ?></p>
        </div>
    <?php endif; ?>

    <div class="scalz-layout">

        <!-- ===== MAIN COLUMN ===== -->
        <div class="scalz-main">

        <?php if ( 'general' === $active_tab ) : /* ── GENERAL TAB ── */ ?>

            <!-- API Key card -->
            <div class="scalz-card">
                <h2 class="scalz-card-title"><?php esc_html_e( 'API Key', 'scalz-seo-automator' ); ?></h2>
                <form method="post" action="options.php">
                    <?php settings_fields( 'scalz_seo_general_settings' ); ?>
                    <table class="form-table" role="presentation">
                        <tr>
                            <th scope="row">
                                <label for="scalz_seo_api_key"><?php esc_html_e( 'Site API Key', 'scalz-seo-automator' ); ?></label>
                            </th>
                            <td>
                                <div style="display:flex;gap:8px;align-items:center;">
                                    <input type="text" id="scalz_seo_api_key" name="scalz_seo_api_key"
                                           value="<?php echo esc_attr( $api_key ); ?>"
                                           class="regular-text code" readonly />
                                    <button type="button" class="button"
                                            onclick="navigator.clipboard.writeText(document.getElementById('scalz_seo_api_key').value);this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',1500)">
                                        <?php esc_html_e( 'Copy', 'scalz-seo-automator' ); ?>
                                    </button>
                                </div>
                                <p class="description">
                                    <?php esc_html_e( 'Auto-generated. Use this key in the Scalz dashboard when connecting this site.', 'scalz-seo-automator' ); ?>
                                </p>
                            </td>
                        </tr>
                    </table>
                    <?php submit_button( __( 'Save General Settings', 'scalz-seo-automator' ), 'primary large scalz-save-btn' ); ?>
                </form>
            </div><!-- /API key card -->

            <!-- AI Provider card -->
            <div class="scalz-card">
                <h2 class="scalz-card-title"><?php esc_html_e( 'AI Provider', 'scalz-seo-automator' ); ?></h2>
                <form method="post" action="options.php">
                    <?php settings_fields( 'scalz_seo_ai_settings' ); ?>
                    <table class="form-table" role="presentation">
                        <tr>
                            <th scope="row"><?php esc_html_e( 'Provider', 'scalz-seo-automator' ); ?></th>
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
                            </td>
                        </tr>
                        <tr id="openai-creds" <?php echo 'openai' !== $provider ? 'style="display:none"' : ''; ?>>
                            <th scope="row">
                                <label for="scalz_seo_openai_api_key"><?php esc_html_e( 'OpenAI API Key', 'scalz-seo-automator' ); ?></label>
                            </th>
                            <td>
                                <input type="password" id="scalz_seo_openai_api_key" name="scalz_seo_openai_api_key"
                                       value="<?php echo esc_attr( $openai_key ); ?>"
                                       class="regular-text" autocomplete="new-password" />
                                <p class="description"><?php esc_html_e( 'Starts with sk-. Only required if using OpenAI provider.', 'scalz-seo-automator' ); ?></p>
                            </td>
                        </tr>
                        <tr id="openai-model" <?php echo 'openai' !== $provider ? 'style="display:none"' : ''; ?>>
                            <th scope="row">
                                <label for="scalz_seo_openai_model"><?php esc_html_e( 'Model', 'scalz-seo-automator' ); ?></label>
                            </th>
                            <td>
                                <select id="scalz_seo_openai_model" name="scalz_seo_openai_model">
                                    <option value="gpt-4o"       <?php selected( $model, 'gpt-4o' ); ?>>GPT-4o</option>
                                    <option value="gpt-4o-mini"  <?php selected( $model, 'gpt-4o-mini' ); ?>>GPT-4o Mini</option>
                                    <option value="gpt-4-turbo"  <?php selected( $model, 'gpt-4-turbo' ); ?>>GPT-4 Turbo</option>
                                    <option value="gpt-3.5-turbo" <?php selected( $model, 'gpt-3.5-turbo' ); ?>>GPT-3.5 Turbo</option>
                                </select>
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
                    (function(){
                        var radios = document.querySelectorAll('input[name="scalz_seo_ai_provider"]');
                        var rows   = document.querySelectorAll('#openai-creds,#openai-model');
                        radios.forEach(function(r){
                            r.addEventListener('change',function(){
                                rows.forEach(function(row){ row.style.display = r.value==='openai'?'':'none'; });
                            });
                        });
                    })();
                    </script>
                    <?php submit_button( __( 'Save AI Settings', 'scalz-seo-automator' ), 'primary large scalz-save-btn' ); ?>
                </form>
            </div><!-- /AI Provider card -->

            <!-- Prompt Templates card -->
            <div class="scalz-card">
                <h2 class="scalz-card-title"><?php esc_html_e( 'Prompt Templates', 'scalz-seo-automator' ); ?></h2>
                <p class="scalz-card-desc">
                    <?php esc_html_e( 'These are the master prompt templates used by the Scalz dashboard for AI generation tasks. Use {variable} placeholders — see the reference in the sidebar.', 'scalz-seo-automator' ); ?>
                </p>
                <form method="post" action="options.php">
                    <?php settings_fields( 'scalz_seo_prompt_settings' ); ?>
                    <table class="form-table" role="presentation">
                        <?php
                        $prompt_fields = [
                            [
                                'id'          => 'scalz_seo_prompt_page_title',
                                'label'       => __( 'Page Title Template', 'scalz-seo-automator' ),
                                'value'       => $prompt_page_title,
                                'description' => __( 'Variables: {service}, {city}, {state_abbr}, {business_name}', 'scalz-seo-automator' ),
                                'type'        => 'text',
                            ],
                            [
                                'id'          => 'scalz_seo_prompt_meta_description',
                                'label'       => __( 'Meta Description Prompt', 'scalz-seo-automator' ),
                                'value'       => $prompt_meta_description,
                                'description' => __( 'Variables: {title}, {service}, {location}', 'scalz-seo-automator' ),
                                'rows'        => 3,
                            ],
                            [
                                'id'          => 'scalz_seo_prompt_acf_content',
                                'label'       => __( 'ACF Content Prompt', 'scalz-seo-automator' ),
                                'value'       => $prompt_acf_content,
                                'description' => __( 'Variables: {niche}, {focus_keyword}, {location}, {business_name}, {phone}', 'scalz-seo-automator' ),
                                'rows'        => 5,
                            ],
                            [
                                'id'          => 'scalz_seo_prompt_blog_title',
                                'label'       => __( 'Blog Title Prompt', 'scalz-seo-automator' ),
                                'value'       => $prompt_blog_title,
                                'description' => __( 'Variables: {count}, {niche}, {city}, {state}, {business_name}, {existing_titles}', 'scalz-seo-automator' ),
                                'rows'        => 4,
                            ],
                            [
                                'id'          => 'scalz_seo_prompt_blog_content',
                                'label'       => __( 'Blog Content Prompt', 'scalz-seo-automator' ),
                                'value'       => $prompt_blog_content,
                                'description' => __( 'AI prompt used by /content/generate when generating blog content. Variables: {title}, {business_name}, {city}, {state}, {focus_keyword}', 'scalz-seo-automator' ),
                                'rows'        => 5,
                            ],
                            [
                                'id'          => 'scalz_seo_prompt_faq',
                                'label'       => __( 'FAQ Schema Prompt', 'scalz-seo-automator' ),
                                'value'       => $prompt_faq,
                                'description' => __( 'Variables: {service}, {location}, {business_name}', 'scalz-seo-automator' ),
                                'rows'        => 4,
                            ],
                            [
                                'id'          => 'scalz_seo_prompt_alt_tag',
                                'label'       => __( 'Alt Tag Prompt', 'scalz-seo-automator' ),
                                'value'       => $prompt_alt_tag,
                                'description' => __( 'Variables: {service}, {city}, {state_abbr}, {business_name}', 'scalz-seo-automator' ),
                                'rows'        => 3,
                            ],
                        ];
                        foreach ( $prompt_fields as $field ) :
                            $is_textarea = isset( $field['rows'] );
                            ?>
                            <tr>
                                <th scope="row">
                                    <label for="<?php echo esc_attr( $field['id'] ); ?>">
                                        <?php echo esc_html( $field['label'] ); ?>
                                    </label>
                                </th>
                                <td>
                                    <?php if ( $is_textarea ) : ?>
                                        <textarea id="<?php echo esc_attr( $field['id'] ); ?>"
                                                  name="<?php echo esc_attr( $field['id'] ); ?>"
                                                  rows="<?php echo esc_attr( $field['rows'] ); ?>"
                                                  class="large-text"><?php echo esc_textarea( $field['value'] ); ?></textarea>
                                    <?php else : ?>
                                        <input type="text"
                                               id="<?php echo esc_attr( $field['id'] ); ?>"
                                               name="<?php echo esc_attr( $field['id'] ); ?>"
                                               value="<?php echo esc_attr( $field['value'] ); ?>"
                                               class="large-text"
                                               type="text" />
                                    <?php endif; ?>
                                    <p class="description"><?php echo esc_html( $field['description'] ); ?></p>
                                </td>
                            </tr>
                            <?php
                        endforeach;
                        ?>
                    </table>
                    <?php submit_button( __( 'Save Prompt Templates', 'scalz-seo-automator' ), 'primary large scalz-save-btn' ); ?>
                </form>
            </div><!-- /Prompt Templates card -->

            <!-- API Endpoints Reference card -->
            <div class="scalz-card">
                <h2 class="scalz-card-title"><?php esc_html_e( 'API Endpoint Reference', 'scalz-seo-automator' ); ?></h2>
                <p class="scalz-card-desc">
                    <?php
                    printf(
                        /* translators: %s: REST API base URL */
                        esc_html__( 'All endpoints are under %s. Authenticate with the header: X-Scalz-API-Key: <your-key>.', 'scalz-seo-automator' ),
                        '<code>' . esc_html( get_rest_url( null, 'scalz/v1' ) ) . '</code>'
                    );
                    ?>
                </p>
                <table class="widefat striped api-endpoints-table" style="font-size:13px;">
                    <thead>
                        <tr>
                            <th><?php esc_html_e( 'Method', 'scalz-seo-automator' ); ?></th>
                            <th><?php esc_html_e( 'Endpoint', 'scalz-seo-automator' ); ?></th>
                            <th><?php esc_html_e( 'Description', 'scalz-seo-automator' ); ?></th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ( $endpoints as $ep ) :
                            $cls    = 'GET' === $ep['method'] ? 'scalz-method--get' : ( 'POST' === $ep['method'] ? 'scalz-method--post' : 'scalz-method--put' );
                            ?>
                            <tr>
                                <td><span class="scalz-method <?php echo esc_attr( $cls ); ?>"><?php echo esc_html( $ep['method'] ); ?></span></td>
                                <td><code><?php echo esc_html( $ep['path'] ); ?></code></td>
                                <td><?php echo esc_html( $ep['description'] ); ?></td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div><!-- /API Endpoints Reference card -->

        <?php endif; /* general tab */ ?>

        <?php if ( 'white_label' === $active_tab ) : /* ── WHITE LABEL TAB ── */ ?>

            <div class="scalz-card">
                <h2 class="scalz-card-title"><?php esc_html_e( 'White Label Settings', 'scalz-seo-automator' ); ?></h2>
                <form method="post" action="options.php">
                    <?php settings_fields( 'scalz_seo_white_label_settings' ); ?>
                    <table class="form-table" role="presentation">
                        <tr>
                            <th scope="row">
                                <label for="wl_agency_name"><?php esc_html_e( 'Agency Name', 'scalz-seo-automator' ); ?></label>
                            </th>
                            <td>
                                <input type="text" id="wl_agency_name"
                                       name="scalz_seo_white_label[agency_name]"
                                       value="<?php echo esc_attr( $wl['agency_name'] ); ?>"
                                       class="regular-text" />
                                <p class="description"><?php esc_html_e( 'Shown in the plugin page header.', 'scalz-seo-automator' ); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">
                                <label for="wl_agency_url"><?php esc_html_e( 'Agency Website URL', 'scalz-seo-automator' ); ?></label>
                            </th>
                            <td>
                                <input type="url" id="wl_agency_url"
                                       name="scalz_seo_white_label[agency_url]"
                                       value="<?php echo esc_attr( $wl['agency_url'] ); ?>"
                                       class="regular-text" />
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">
                                <label for="wl_plugin_name"><?php esc_html_e( 'Plugin Display Name', 'scalz-seo-automator' ); ?></label>
                            </th>
                            <td>
                                <input type="text" id="wl_plugin_name"
                                       name="scalz_seo_white_label[plugin_name]"
                                       value="<?php echo esc_attr( $wl['plugin_name'] ); ?>"
                                       class="regular-text" />
                                <p class="description"><?php esc_html_e( 'Shown in WP admin menu and page title.', 'scalz-seo-automator' ); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">
                                <label for="wl_menu_icon"><?php esc_html_e( 'Admin Menu Icon', 'scalz-seo-automator' ); ?></label>
                            </th>
                            <td>
                                <input type="text" id="wl_menu_icon"
                                       name="scalz_seo_white_label[menu_icon]"
                                       value="<?php echo esc_attr( $wl['menu_icon'] ); ?>"
                                       class="regular-text" />
                                <p class="description">
                                    <?php esc_html_e( 'Dashicons class, e.g. dashicons-chart-area.', 'scalz-seo-automator' ); ?>
                                    <a href="https://developer.wordpress.org/resource/dashicons/" target="_blank">dashicons reference</a>
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e( 'Hide Branding', 'scalz-seo-automator' ); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox"
                                           name="wl_hide_branding"
                                           value="1" <?php checked( ! empty( $wl['hide_branding'] ) ); ?> />
                                    <?php esc_html_e( 'Hide \'Powered by Scalz\' footer text on this settings page', 'scalz-seo-automator' ); ?>
                                </label>
                            </td>
                        </tr>
                    </table>
                    <?php submit_button( __( 'Save White Label Settings', 'scalz-seo-automator' ), 'primary large scalz-save-btn' ); ?>

                </form>

            </div><!-- /White Label card -->

            <?php submit_button( __( 'Save White Label Settings', 'scalz-seo-automator' ), 'primary large scalz-save-btn' ); ?>

        </form>

        </div><!-- /scalz-main white label -->

        <?php endif; /* white_label tab */ ?>

    </div><!-- /scalz-layout -->

</div><!-- /wrap -->
