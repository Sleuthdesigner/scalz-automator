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
$prompt_acf_content      = get_option( 'scalz_seo_prompt_acf_content',       'Write SEO and AEO optimized HTML content for a {niche} business page targeting the keyword "{focus_keyword}" in {location}. Business name: {business_name}. Phone: {phone}. Include relevant H2 subheadings, a brief intro, service benefits, and a clear call to action. Output only the HTML content.' );
$prompt_blog_title       = get_option( 'scalz_seo_prompt_blog_title',        'Generate {count} unique, SEO-optimized blog post titles for a {niche} business in {location}. Target long-tail local keywords. Do NOT duplicate: {existing_titles}. Return only a JSON array of strings.' );
$prompt_blog_content     = get_option( 'scalz_seo_prompt_blog_content',      'Write a comprehensive, SEO-optimized blog post titled "{title}" for a {niche} business in {location}. Use H2 subheadings (not H3-H6), include practical tips, a FAQ section at the end, and a call to action. Output only well-structured HTML.' );
$prompt_alt_tag          = get_option( 'scalz_seo_prompt_alt_tag',           'Write a concise, descriptive SEO alt tag (max 125 characters) for an image on a page titled "{title}" about {service} in {location}. Output only the alt tag text, no quotes.' );

// Notification messages.
$saved      = isset( $_GET['saved'] )      && '1' === sanitize_key( $_GET['saved'] );
$regenerated = isset( $_GET['regenerated'] ) && '1' === sanitize_key( $_GET['regenerated'] );

// Available OpenAI models.
$openai_models = [
    'gpt-4o'        => 'GPT-4o (Recommended)',
    'gpt-4o-mini'   => 'GPT-4o Mini (Fast & Cheap)',
    'gpt-4-turbo'   => 'GPT-4 Turbo',
    'gpt-4'         => 'GPT-4',
    'gpt-3.5-turbo' => 'GPT-3.5 Turbo (Legacy)',
];

// Template variable reference.
$template_vars = [
    '{title}'            => 'Page / post title',
    '{location}'         => 'Full location (City, State)',
    '{city}'             => 'City name',
    '{state}'            => 'Full state name',
    '{state_abbr}'       => 'State abbreviation',
    '{business_name}'    => 'Business / site name',
    '{service}'          => 'Service name',
    '{niche}'            => 'Business niche / industry',
    '{phone}'            => 'Business phone number',
    '{address}'          => 'Business address',
    '{existing_content}' => 'Current page content (stripped HTML)',
    '{focus_keyword}'    => 'Target SEO keyword (from RankMath)',
    '{count}'            => 'Number of items to generate',
    '{existing_titles}'  => 'Pipe-separated list of existing titles',
];

// Integration status.
$integration_manager = new Scalz_Integration_Manager();
$integrations        = $integration_manager->get_active_integrations();
?>
<div class="wrap scalz-settings-wrap">

    <div class="scalz-header">
        <div class="scalz-header__logo">
            <span class="scalz-logo-icon">⚡</span>
            <h1><?php esc_html_e( 'Scalz SEO Automator', 'scalz-seo-automator' ); ?></h1>
            <span class="scalz-version">v<?php echo esc_html( SCALZ_SEO_VERSION ); ?></span>
        </div>
        <p class="scalz-header__desc">
            <?php esc_html_e( 'Companion plugin for the Scalz AI dashboard. Configure your API key, AI provider, and prompt templates below.', 'scalz-seo-automator' ); ?>
        </p>
    </div>

    <!-- Tab Navigation -->
    <nav class="nav-tab-wrapper scalz-tab-nav">
        <a href="<?php echo esc_url( add_query_arg( [ 'page' => 'scalz-seo-automator', 'tab' => 'general' ], admin_url( 'options-general.php' ) ) ); ?>"
           class="nav-tab <?php echo 'general' === $active_tab ? 'nav-tab-active' : ''; ?>">
            <?php esc_html_e( 'General', 'scalz-seo-automator' ); ?>
        </a>
        <a href="<?php echo esc_url( add_query_arg( [ 'page' => 'scalz-seo-automator', 'tab' => 'white_label' ], admin_url( 'options-general.php' ) ) ); ?>"
           class="nav-tab <?php echo 'white_label' === $active_tab ? 'nav-tab-active' : ''; ?>">
            <?php esc_html_e( 'White Label', 'scalz-seo-automator' ); ?>
        </a>
    </nav>

    <?php if ( $saved ) : ?>
        <div class="notice notice-success is-dismissible">
            <p><?php esc_html_e( 'Settings saved successfully.', 'scalz-seo-automator' ); ?></p>
        </div>
    <?php endif; ?>

    <?php if ( $regenerated ) : ?>
        <div class="notice notice-success is-dismissible">
            <p><?php esc_html_e( 'API key regenerated. Make sure to update it in your Scalz dashboard.', 'scalz-seo-automator' ); ?></p>
        </div>
    <?php endif; ?>

    <div class="scalz-layout">

        <?php if ( 'general' === $active_tab ) : ?>

        <!-- ── Main Settings Column ─────────────────────────────────────── -->
        <div class="scalz-main">

            <!-- API Key Section -->
            <div class="scalz-card">
                <h2 class="scalz-card__title">
                    <span class="scalz-card__icon">🔑</span>
                    <?php esc_html_e( 'API Key', 'scalz-seo-automator' ); ?>
                </h2>
                <p class="scalz-card__desc">
                    <?php esc_html_e( 'This key is sent in the X-Scalz-API-Key header by the Scalz dashboard to authenticate all requests.', 'scalz-seo-automator' ); ?>
                </p>

                <div class="scalz-api-key-display">
                    <code id="scalz-api-key-value"><?php echo esc_html( $api_key ?: __( 'Not set', 'scalz-seo-automator' ) ); ?></code>
                    <button
                        type="button"
                        class="button"
                        onclick="document.getElementById('scalz-api-key-value').style.filter = (document.getElementById('scalz-api-key-value').style.filter ? '' : 'blur(5px)')">
                        <?php esc_html_e( 'Toggle Visibility', 'scalz-seo-automator' ); ?>
                    </button>
                    <button
                        type="button"
                        class="button"
                        onclick="navigator.clipboard.writeText('<?php echo esc_js( $api_key ); ?>').then(function(){ alert('<?php esc_attr_e( 'Copied!', 'scalz-seo-automator' ); ?>') })">
                        <?php esc_html_e( 'Copy', 'scalz-seo-automator' ); ?>
                    </button>
                </div>

                <div class="scalz-api-key-endpoints">
                    <strong><?php esc_html_e( 'Base API URL:', 'scalz-seo-automator' ); ?></strong>
                    <code><?php echo esc_html( get_rest_url( null, SCALZ_SEO_API_NS ) ); ?></code>
                </div>

                <!-- Regenerate Key Form -->
                <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="scalz-regenerate-form">
                    <input type="hidden" name="action" value="scalz_seo_regenerate_key">
                    <?php wp_nonce_field( 'scalz_seo_regenerate_key_nonce', 'scalz_seo_nonce' ); ?>
                    <button
                        type="submit"
                        class="button button-secondary"
                        onclick="return confirm('<?php esc_attr_e( 'Regenerate the API key? Your dashboard will need to be updated with the new key.', 'scalz-seo-automator' ); ?>')">
                        <?php esc_html_e( 'Regenerate API Key', 'scalz-seo-automator' ); ?>
                    </button>
                </form>
            </div><!-- /API Key Section -->

            <!-- Main Settings Form -->
            <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="scalz-settings-form">
                <input type="hidden" name="action" value="scalz_seo_save_settings">
                <?php wp_nonce_field( 'scalz_seo_save_settings_nonce', 'scalz_seo_nonce' ); ?>

                <!-- AI Provider Section -->
                <div class="scalz-card">
                    <h2 class="scalz-card__title">
                        <span class="scalz-card__icon">🤖</span>
                        <?php esc_html_e( 'AI Configuration', 'scalz-seo-automator' ); ?>
                    </h2>

                    <table class="form-table scalz-form-table">
                        <tr>
                            <th scope="row">
                                <label for="scalz_seo_ai_provider">
                                    <?php esc_html_e( 'AI Provider', 'scalz-seo-automator' ); ?>
                                </label>
                            </th>
                            <td>
                                <fieldset>
                                    <label class="scalz-radio-label">
                                        <input
                                            type="radio"
                                            name="scalz_seo_ai_provider"
                                            value="openai"
                                            <?php checked( $provider, 'openai' ); ?>
                                            onchange="document.getElementById('scalz-openai-fields').style.display='block'"
                                        >
                                        <span>OpenAI (Direct API)</span>
                                    </label>
                                    <br>
                                    <label class="scalz-radio-label">
                                        <input
                                            type="radio"
                                            name="scalz_seo_ai_provider"
                                            value="ai_engine"
                                            <?php checked( $provider, 'ai_engine' ); ?>
                                            onchange="document.getElementById('scalz-openai-fields').style.display='none'"
                                        >
                                        <span>AI Engine by Meow Apps</span>
                                    </label>
                                </fieldset>
                            </td>
                        </tr>
                    </table>

                    <!-- OpenAI-specific fields -->
                    <div id="scalz-openai-fields" style="<?php echo 'openai' !== $provider ? 'display:none;' : ''; ?>">
                        <table class="form-table scalz-form-table">
                            <tr>
                                <th scope="row">
                                    <label for="scalz_seo_openai_api_key">
                                        <?php esc_html_e( 'OpenAI API Key', 'scalz-seo-automator' ); ?>
                                    </label>
                                </th>
                                <td>
                                    <input
                                        type="password"
                                        id="scalz_seo_openai_api_key"
                                        name="scalz_seo_openai_api_key"
                                        value="<?php echo esc_attr( $openai_key ); ?>"
                                        class="regular-text"
                                        autocomplete="new-password"
                                        placeholder="sk-..."
                                    >
                                    <p class="description">
                                        <?php
                                        printf(
                                            /* translators: %s: link to OpenAI API keys page */
                                            esc_html__( 'Get your key from %s', 'scalz-seo-automator' ),
                                            '<a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">platform.openai.com/api-keys</a>'
                                        );
                                        ?>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">
                                    <label for="scalz_seo_openai_model">
                                        <?php esc_html_e( 'Default Model', 'scalz-seo-automator' ); ?>
                                    </label>
                                </th>
                                <td>
                                    <select id="scalz_seo_openai_model" name="scalz_seo_openai_model" class="regular-text">
                                        <?php foreach ( $openai_models as $model_id => $model_label ) : ?>
                                            <option value="<?php echo esc_attr( $model_id ); ?>" <?php selected( $model, $model_id ); ?>>
                                                <?php echo esc_html( $model_label ); ?>
                                            </option>
                                        <?php endforeach; ?>
                                    </select>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">
                                    <label for="scalz_seo_ai_temperature">
                                        <?php esc_html_e( 'Temperature', 'scalz-seo-automator' ); ?>
                                    </label>
                                </th>
                                <td>
                                    <input
                                        type="number"
                                        id="scalz_seo_ai_temperature"
                                        name="scalz_seo_ai_temperature"
                                        value="<?php echo esc_attr( $temperature ); ?>"
                                        min="0"
                                        max="2"
                                        step="0.1"
                                        class="small-text"
                                    >
                                    <p class="description">
                                        <?php esc_html_e( '0 = deterministic, 1 = balanced (recommended for SEO), 2 = very creative.', 'scalz-seo-automator' ); ?>
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </div><!-- /OpenAI fields -->
                </div><!-- /AI Configuration -->

                <!-- Prompt Templates Section -->
                <div class="scalz-card">
                    <h2 class="scalz-card__title">
                        <span class="scalz-card__icon">📝</span>
                        <?php esc_html_e( 'Prompt Templates', 'scalz-seo-automator' ); ?>
                    </h2>
                    <p class="scalz-card__desc">
                        <?php esc_html_e( 'These are the master prompt templates used by the Scalz dashboard for AI generation tasks. Use {variable} placeholders — see the reference in the sidebar.', 'scalz-seo-automator' ); ?>
                    </p>

                    <?php
                    $prompt_fields = [
                        [
                            'id'          => 'scalz_seo_prompt_page_title',
                            'label'       => __( 'Page Title Template', 'scalz-seo-automator' ),
                            'value'       => $prompt_page_title,
                            'description' => __( 'Used by /pages/update-titles to format page titles. This is a title pattern, not an AI prompt.', 'scalz-seo-automator' ),
                            'rows'        => 2,
                        ],
                        [
                            'id'          => 'scalz_seo_prompt_meta_description',
                            'label'       => __( 'Meta Description Prompt', 'scalz-seo-automator' ),
                            'value'       => $prompt_meta_description,
                            'description' => __( 'AI prompt for /seo/meta-descriptions with auto_generate:true.', 'scalz-seo-automator' ),
                            'rows'        => 4,
                        ],
                        [
                            'id'          => 'scalz_seo_prompt_acf_content',
                            'label'       => __( 'ACF Content Prompt', 'scalz-seo-automator' ),
                            'value'       => $prompt_acf_content,
                            'description' => __( 'AI prompt for /content/generate when no prompt_template is supplied by the caller.', 'scalz-seo-automator' ),
                            'rows'        => 5,
                        ],
                        [
                            'id'          => 'scalz_seo_prompt_blog_title',
                            'label'       => __( 'Blog Title Generation Prompt', 'scalz-seo-automator' ),
                            'value'       => $prompt_blog_title,
                            'description' => __( 'AI prompt for /blogs/generate-titles. Must instruct AI to return a JSON array.', 'scalz-seo-automator' ),
                            'rows'        => 4,
                        ],
                        [
                            'id'          => 'scalz_seo_prompt_blog_content',
                            'label'       => __( 'Blog Content Prompt', 'scalz-seo-automator' ),
                            'value'       => $prompt_blog_content,
                            'description' => __( 'AI prompt used by /content/generate when generating full blog post content.', 'scalz-seo-automator' ),
                            'rows'        => 5,
                        ],
                        [
                            'id'          => 'scalz_seo_prompt_alt_tag',
                            'label'       => __( 'Alt Tag Prompt', 'scalz-seo-automator' ),
                            'value'       => $prompt_alt_tag,
                            'description' => __( 'AI prompt for /seo/alt-tags. Should output just the alt text, max 125 characters.', 'scalz-seo-automator' ),
                            'rows'        => 3,
                        ],
                    ];

                    foreach ( $prompt_fields as $field ) :
                    ?>
                        <div class="scalz-prompt-field">
                            <label for="<?php echo esc_attr( $field['id'] ); ?>" class="scalz-prompt-label">
                                <?php echo esc_html( $field['label'] ); ?>
                            </label>
                            <textarea
                                id="<?php echo esc_attr( $field['id'] ); ?>"
                                name="<?php echo esc_attr( $field['id'] ); ?>"
                                rows="<?php echo (int) $field['rows']; ?>"
                                class="large-text scalz-prompt-textarea"
                            ><?php echo esc_textarea( $field['value'] ); ?></textarea>
                            <p class="description"><?php echo esc_html( $field['description'] ); ?></p>
                        </div>
                    <?php endforeach; ?>
                </div><!-- /Prompt Templates -->

                <?php submit_button( __( 'Save Settings', 'scalz-seo-automator' ), 'primary large scalz-save-btn' ); ?>

            </form><!-- /Main Settings Form -->

        </div><!-- /scalz-main -->

        <!-- ── Sidebar Column ─────────────────────────────────────────────── -->
        <div class="scalz-sidebar">

            <!-- Integration Status -->
            <div class="scalz-card scalz-card--sidebar">
                <h3 class="scalz-card__title scalz-card__title--small">
                    <?php esc_html_e( 'Integrations', 'scalz-seo-automator' ); ?>
                </h3>
                <ul class="scalz-integration-list">
                    <?php
                    $integration_labels = [
                        'rankmath'     => 'RankMath SEO',
                        'acf'          => 'Advanced Custom Fields',
                        'link_whisper' => 'LinkWhisper',
                        'ai_engine'    => 'AI Engine (Meow Apps)',
                        'openai'       => 'OpenAI API Key',
                    ];
                    foreach ( $integration_labels as $key => $label ) :
                        $active = ! empty( $integrations[ $key ] );
                    ?>
                        <li class="scalz-integration-item <?php echo $active ? 'scalz-integration-item--active' : 'scalz-integration-item--inactive'; ?>">
                            <span class="scalz-integration-dot"></span>
                            <span class="scalz-integration-name"><?php echo esc_html( $label ); ?></span>
                            <span class="scalz-integration-status">
                                <?php echo $active ? esc_html__( 'Active', 'scalz-seo-automator' ) : esc_html__( 'Not detected', 'scalz-seo-automator' ); ?>
                            </span>
                        </li>
                    <?php endforeach; ?>
                </ul>
            </div>

            <!-- Template Variable Reference -->
            <div class="scalz-card scalz-card--sidebar">
                <h3 class="scalz-card__title scalz-card__title--small">
                    <?php esc_html_e( 'Template Variables', 'scalz-seo-automator' ); ?>
                </h3>
                <p class="description">
                    <?php esc_html_e( 'Use these {variables} in prompt templates and the dashboard will replace them at runtime.', 'scalz-seo-automator' ); ?>
                </p>
                <dl class="scalz-var-list">
                    <?php foreach ( $template_vars as $var => $desc ) : ?>
                        <dt>
                            <code class="scalz-var-code"><?php echo esc_html( $var ); ?></code>
                        </dt>
                        <dd class="scalz-var-desc"><?php echo esc_html( $desc ); ?></dd>
                    <?php endforeach; ?>
                </dl>
            </div>

            <!-- API Endpoint Reference -->
            <div class="scalz-card scalz-card--sidebar">
                <h3 class="scalz-card__title scalz-card__title--small">
                    <?php esc_html_e( 'REST Endpoints', 'scalz-seo-automator' ); ?>
                </h3>
                <ul class="scalz-endpoint-list">
                    <?php
                    $endpoints = [
                        'GET  /status',
                        'GET  /site-info',
                        'GET  /sitemap/posts',
                        'POST /plugins/install',
                        'POST /pages/update-titles',
                        'POST /seo/meta-descriptions',
                        'POST /seo/alt-tags',
                        'POST /content/acf-update',
                        'POST /content/generate',
                        'POST /linking/run',
                        'POST /blogs/generate-titles',
                        'POST /blogs/create',
                        'POST /blogs/fix-headings',
                        'POST /schema/faq',
                        'POST /ai/configure',
                        'POST /rankmath/optimize',
                    ];
                    foreach ( $endpoints as $ep ) :
                        $parts  = explode( ' ', $ep, 2 );
                        $method = $parts[0];
                        $path   = $parts[1];
                        $cls    = 'GET' === $method ? 'scalz-method--get' : 'scalz-method--post';
                    ?>
                        <li class="scalz-endpoint-item">
                            <span class="scalz-method <?php echo esc_attr( $cls ); ?>"><?php echo esc_html( $method ); ?></span>
                            <code class="scalz-endpoint-path"><?php echo esc_html( $path ); ?></code>
                        </li>
                    <?php endforeach; ?>
                </ul>
                <p class="description">
                    <?php
                    printf(
                        /* translators: %s: base URL */
                        esc_html__( 'All under: %s', 'scalz-seo-automator' ),
                        '<code>' . esc_html( '/wp-json/' . SCALZ_SEO_API_NS ) . '</code>'
                    );
                    ?>
                </p>
            </div>

        </div><!-- /scalz-sidebar -->

        <?php endif; /* general tab */ ?>

        <?php if ( 'white_label' === $active_tab ) : ?>

        <!-- ── White Label Settings ────────────────────────────────── -->
        <div class="scalz-main" style="max-width:700px;">

            <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="scalz-settings-form">
                <input type="hidden" name="action" value="scalz_seo_save_white_label">
                <?php wp_nonce_field( 'scalz_seo_save_white_label_nonce', 'scalz_seo_wl_nonce' ); ?>

                <div class="scalz-card">
                    <h2 class="scalz-card__title">
                        <span class="scalz-card__icon">🏷️</span>
                        <?php esc_html_e( 'White Label Settings', 'scalz-seo-automator' ); ?>
                    </h2>
                    <p class="scalz-card__desc">
                        <?php esc_html_e( 'Customize how this plugin appears in the WordPress admin for your clients.', 'scalz-seo-automator' ); ?>
                    </p>

                    <table class="form-table scalz-form-table">
                        <tr>
                            <th scope="row">
                                <label for="wl_agency_name">
                                    <?php esc_html_e( 'Agency Name', 'scalz-seo-automator' ); ?>
                                </label>
                            </th>
                            <td>
                                <input
                                    type="text"
                                    id="wl_agency_name"
                                    name="wl_agency_name"
                                    value="<?php echo esc_attr( $wl['agency_name'] ); ?>"
                                    class="regular-text"
                                    placeholder="My Agency"
                                >
                                <p class="description"><?php esc_html_e( 'Your agency or company name, shown in the plugin header.', 'scalz-seo-automator' ); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">
                                <label for="wl_agency_url">
                                    <?php esc_html_e( 'Agency URL', 'scalz-seo-automator' ); ?>
                                </label>
                            </th>
                            <td>
                                <input
                                    type="url"
                                    id="wl_agency_url"
                                    name="wl_agency_url"
                                    value="<?php echo esc_attr( $wl['agency_url'] ); ?>"
                                    class="regular-text"
                                    placeholder="https://myagency.com"
                                >
                                <p class="description"><?php esc_html_e( 'Link for your agency name (optional).', 'scalz-seo-automator' ); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">
                                <label for="wl_plugin_name">
                                    <?php esc_html_e( 'Plugin Display Name', 'scalz-seo-automator' ); ?>
                                </label>
                            </th>
                            <td>
                                <input
                                    type="text"
                                    id="wl_plugin_name"
                                    name="wl_plugin_name"
                                    value="<?php echo esc_attr( $wl['plugin_name'] ); ?>"
                                    class="regular-text"
                                    placeholder="SEO Automator"
                                >
                                <p class="description"><?php esc_html_e( 'The name shown in the WordPress admin menu.', 'scalz-seo-automator' ); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">
                                <label for="wl_menu_icon">
                                    <?php esc_html_e( 'Menu Icon', 'scalz-seo-automator' ); ?>
                                </label>
                            </th>
                            <td>
                                <input
                                    type="text"
                                    id="wl_menu_icon"
                                    name="wl_menu_icon"
                                    value="<?php echo esc_attr( $wl['menu_icon'] ); ?>"
                                    class="regular-text"
                                    placeholder="dashicons-chart-area"
                                >
                                <p class="description">
                                    <?php
                                    printf(
                                        /* translators: %s: link to dashicons reference */
                                        esc_html__( 'Dashicons class for the admin menu icon. Browse icons at %s.', 'scalz-seo-automator' ),
                                        '<a href="https://developer.wordpress.org/resource/dashicons/" target="_blank" rel="noopener noreferrer">developer.wordpress.org/resource/dashicons</a>'
                                    );
                                    ?>
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">
                                <?php esc_html_e( 'Hide Branding', 'scalz-seo-automator' ); ?>
                            </th>
                            <td>
                                <label>
                                    <input
                                        type="checkbox"
                                        name="wl_hide_branding"
                                        value="1"
                                        <?php checked( ! empty( $wl['hide_branding'] ) ); ?>
                                    >
                                    <?php esc_html_e( 'Hide "Scalz" branding from plugin header and footer', 'scalz-seo-automator' ); ?>
                                </label>
                            </td>
                        </tr>
                    </table>
                </div><!-- /White Label card -->

                <?php submit_button( __( 'Save White Label Settings', 'scalz-seo-automator' ), 'primary large scalz-save-btn' ); ?>

            </form>

        </div><!-- /scalz-main white label -->

        <?php endif; /* white_label tab */ ?>

    </div><!-- /scalz-layout -->

</div><!-- /wrap -->
