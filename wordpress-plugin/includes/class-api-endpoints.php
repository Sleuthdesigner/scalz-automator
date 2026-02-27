<?php
/**
 * REST API Endpoints Registration
 *
 * Registers all /wp-json/scalz/v1/ endpoints and dispatches
 * requests to the appropriate manager classes.
 *
 * @package ScalzSEOAutomator
 * @since   1.0.0
 */

// Prevent direct access.
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Class Scalz_Api_Endpoints
 *
 * Handles REST API registration and request routing.
 */
class Scalz_Api_Endpoints {

    /** @var Scalz_Seo_Manager */
    private Scalz_Seo_Manager $seo_manager;

    /** @var Scalz_Content_Manager */
    private Scalz_Content_Manager $content_manager;

    /** @var Scalz_Blog_Manager */
    private Scalz_Blog_Manager $blog_manager;

    /** @var Scalz_Integration_Manager */
    private Scalz_Integration_Manager $integration_manager;

    /** @var Scalz_Schema_Manager */
    private Scalz_Schema_Manager $schema_manager;

    /** @var Scalz_Plugin_Installer */
    private Scalz_Plugin_Installer $plugin_installer;

    /** @var Scalz_Settings */
    private Scalz_Settings $settings;

    /** @var Scalz_Internal_Linker|null */
    private ?Scalz_Internal_Linker $internal_linker = null;

    /**
     * Set internal linker instance.
     */
    public function set_internal_linker( Scalz_Internal_Linker $linker ): void {
        $this->internal_linker = $linker;
    }

    /**
     * Constructor.
     *
     * @param Scalz_Seo_Manager         $seo_manager
     * @param Scalz_Content_Manager     $content_manager
     * @param Scalz_Blog_Manager        $blog_manager
     * @param Scalz_Integration_Manager $integration_manager
     * @param Scalz_Schema_Manager      $schema_manager
     * @param Scalz_Plugin_Installer    $plugin_installer
     * @param Scalz_Settings            $settings
     */
    public function __construct(
        Scalz_Seo_Manager $seo_manager,
        Scalz_Content_Manager $content_manager,
        Scalz_Blog_Manager $blog_manager,
        Scalz_Integration_Manager $integration_manager,
        Scalz_Schema_Manager $schema_manager,
        Scalz_Plugin_Installer $plugin_installer,
        Scalz_Settings $settings
    ) {
        $this->seo_manager         = $seo_manager;
        $this->content_manager     = $content_manager;
        $this->blog_manager        = $blog_manager;
        $this->integration_manager = $integration_manager;
        $this->schema_manager      = $schema_manager;
        $this->plugin_installer    = $plugin_installer;
        $this->settings            = $settings;
    }

    /**
     * Register WordPress hooks.
     */
    public function register_hooks(): void {
        add_action( 'rest_api_init', [ $this, 'register_routes' ] );
    }

    /**
     * Register all REST routes.
     */
    public function register_routes(): void {
        $ns = SCALZ_SEO_API_NS;

        // ── Health check ────────────────────────────────────────────────────────────────────
        register_rest_route( $ns, '/status', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [ $this, 'route_status' ],
            'permission_callback' => [ $this, 'check_api_key' ],
        ] );

        // ── Site info ───────────────────────────────────────────────────────────────────────
        register_rest_route( $ns, '/site-info', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [ $this, 'route_site_info' ],
            'permission_callback' => [ $this, 'check_api_key' ],
        ] );

        // ── Plugin installer ────────────────────────────────────────────────────────────────
        register_rest_route( $ns, '/plugins/install', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ $this, 'route_plugins_install' ],
            'permission_callback' => [ $this, 'check_api_key' ],
            'args'                => [
                'plugin_file_url' => [
                    'required'          => true,
                    'type'              => 'string',
                    'sanitize_callback' => 'esc_url_raw',
                    'validate_callback' => function( $val ) {
                        return filter_var( $val, FILTER_VALIDATE_URL ) !== false;
                    },
                ],
                'license_key' => [
                    'required'          => false,
                    'type'              => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                ],
            ],
        ] );

        // ── Page title updates ───────────────────────────────────────────────────────────
        register_rest_route( $ns, '/pages/update-titles', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ $this, 'route_update_titles' ],
            'permission_callback' => [ $this, 'check_api_key' ],
            'args'                => [
                'pages' => [
                    'required' => true,
                    'type'     => 'array',
                ],
            ],
        ] );

        // ── Meta descriptions ───────────────────────────────────────────────────────────
        register_rest_route( $ns, '/seo/meta-descriptions', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ $this, 'route_meta_descriptions' ],
            'permission_callback' => [ $this, 'check_api_key' ],
        ] );

        // ── ACF field detection ────────────────────────────────────────────────────────
        register_rest_route( $ns, '/acf/detect-fields', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [ $this, 'route_acf_detect_fields' ],
            'permission_callback' => [ $this, 'check_api_key' ],
        ] );

        // ── ACF field update ────────────────────────────────────────────────────────────────
        register_rest_route( $ns, '/content/acf-update', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ $this, 'route_acf_update' ],
            'permission_callback' => [ $this, 'check_api_key' ],
            'args'                => [
                'page_id'    => [ 'required' => true, 'type' => 'integer' ],
                'field_name' => [ 'required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_key' ],
                'content'    => [ 'required' => true, 'type' => 'string' ],
                'field_type' => [ 'required' => false, 'type' => 'string', 'default' => 'wysiwyg', 'sanitize_callback' => 'sanitize_key' ],
            ],
        ] );

        // ── AI content generation ───────────────────────────────────────────────────────────
        register_rest_route( $ns, '/content/generate', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ $this, 'route_content_generate' ],
            'permission_callback' => [ $this, 'check_api_key' ],
            'args'                => [
                'page_id'          => [ 'required' => true, 'type' => 'integer' ],
                'field_name'       => [ 'required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_key' ],
                'prompt_template'  => [ 'required' => true, 'type' => 'string' ],
                'variables'        => [ 'required' => false, 'type' => 'object', 'default' => [] ],
            ],
        ] );

        // ── Alt tags ────────────────────────────────────────────────────────────────────────
        register_rest_route( $ns, '/seo/alt-tags', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ $this, 'route_alt_tags' ],
            'permission_callback' => [ $this, 'check_api_key' ],
            'args'                => [
                'page_id' => [ 'required' => false, 'type' => 'integer' ],
            ],
        ] );

        // ── LinkWhisper internal linking ────────────────────────────────────────────────
        register_rest_route( $ns, '/linking/run', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ $this, 'route_linking_run' ],
            'permission_callback' => [ $this, 'check_api_key' ],
            'args'                => [
                'post_ids' => [ 'required' => false, 'type' => 'array', 'default' => [] ],
            ],
        ] );

        // ── Sitemap posts ───────────────────────────────────────────────────────────────────
        register_rest_route( $ns, '/sitemap/posts', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [ $this, 'route_sitemap_posts' ],
            'permission_callback' => [ $this, 'check_api_key' ],
        ] );

        // ── Blog title generation ───────────────────────────────────────────────────────────
        register_rest_route( $ns, '/blogs/generate-titles', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ $this, 'route_blogs_generate_titles' ],
            'permission_callback' => [ $this, 'check_api_key' ],
            'args'                => [
                'count'           => [ 'required' => false, 'type' => 'integer', 'default' => 5, 'minimum' => 1, 'maximum' => 50 ],
                'niche'           => [ 'required' => false, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ],
                'location'        => [ 'required' => false, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ],
                'existing_titles' => [ 'required' => false, 'type' => 'array', 'default' => [] ],
            ],
        ] );

        // ── Blog creation ───────────────────────────────────────────────────────────────────
        register_rest_route( $ns, '/blogs/create', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ $this, 'route_blogs_create' ],
            'permission_callback' => [ $this, 'check_api_key' ],
            'args'                => [
                'title'      => [ 'required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ],
                'content'    => [ 'required' => true, 'type' => 'string' ],
                'categories' => [ 'required' => false, 'type' => 'array', 'default' => [] ],
                'tags'        => [ 'required' => false, 'type' => 'array', 'default' => [] ],
            ],
        ] );

        // ── Fix headings ────────────────────────────────────────────────────────────────────
        register_rest_route( $ns, '/blogs/fix-headings', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ $this, 'route_blogs_fix_headings' ],
            'permission_callback' => [ $this, 'check_api_key' ],
            'args'                => [
                'post_id' => [ 'required' => true, 'type' => 'integer' ],
            ],
        ] );

        // ── FAQ Schema ──────────────────────────────────────────────────────────────────────
        register_rest_route( $ns, '/schema/faq', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ $this, 'route_schema_faq' ],
            'permission_callback' => [ $this, 'check_api_key' ],
            'args'                => [
                'post_id' => [ 'required' => true, 'type' => 'integer' ],
                'faqs'    => [ 'required' => true, 'type' => 'array' ],
            ],
        ] );

        // ── AI configuration ────────────────────────────────────────────────────────────────
        register_rest_route( $ns, '/ai/configure', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ $this, 'route_ai_configure' ],
            'permission_callback' => [ $this, 'check_api_key' ],
            'args'                => [
                'provider'    => [ 'required' => true, 'type' => 'string', 'enum' => [ 'openai', 'ai_engine' ] ],
                'api_key'     => [ 'required' => false, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ],
                'model'       => [ 'required' => false, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ],
                'temperature' => [ 'required' => false, 'type' => 'number', 'minimum' => 0, 'maximum' => 2, 'default' => 0.7 ],
            ],
        ] );

        // ── RankMath optimize ───────────────────────────────────────────────────────────────
        register_rest_route( $ns, '/rankmath/optimize', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ $this, 'route_rankmath_optimize' ],
            'permission_callback' => [ $this, 'check_api_key' ],
            'args'                => [
                'post_id'       => [ 'required' => true, 'type' => 'integer' ],
                'focus_keyword' => [ 'required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ],
            ],
        ] );

        // ── Internal Linking ────────────────────────────────────────────────────────────────
        register_rest_route( $ns, '/linking/suggestions', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ $this, 'route_linking_suggestions' ],
            'permission_callback' => [ $this, 'check_api_key' ],
            'args'                => [
                'post_id' => [ 'required' => true, 'type' => 'integer' ],
            ],
        ] );

        register_rest_route( $ns, '/linking/insert', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ $this, 'route_linking_insert' ],
            'permission_callback' => [ $this, 'check_api_key' ],
            'args'                => [
                'post_id'   => [ 'required' => true, 'type' => 'integer' ],
                'max_links' => [ 'required' => false, 'type' => 'integer', 'default' => 0 ],
            ],
        ] );

        register_rest_route( $ns, '/linking/bulk', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ $this, 'route_linking_bulk' ],
            'permission_callback' => [ $this, 'check_api_key' ],
            'args'                => [
                'post_types' => [ 'required' => false, 'type' => 'array', 'default' => ['post', 'page'] ],
                'max_links'  => [ 'required' => false, 'type' => 'integer', 'default' => 0 ],
            ],
        ] );

        register_rest_route( $ns, '/linking/report', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [ $this, 'route_linking_report' ],
            'permission_callback' => [ $this, 'check_api_key' ],
        ] );

        register_rest_route( $ns, '/linking/orphans', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [ $this, 'route_linking_orphans' ],
            'permission_callback' => [ $this, 'check_api_key' ],
        ] );

        register_rest_route( $ns, '/linking/index', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ $this, 'route_linking_build_index' ],
            'permission_callback' => [ $this, 'check_api_key' ],
        ] );

        register_rest_route( $ns, '/linking/config', [
            'methods'             => WP_REST_Server::EDITABLE,
            'callback'            => [ $this, 'route_linking_config' ],
            'permission_callback' => [ $this, 'check_api_key' ],
        ] );

        register_rest_route( $ns, '/linking/config', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [ $this, 'route_linking_get_config' ],
            'permission_callback' => [ $this, 'check_api_key' ],
        ] );
    }

    /**
     * Validate the X-Scalz-API-Key header against the stored key.
     *
     * @param WP_REST_Request $request Incoming request.
     * @return bool|WP_Error True on success, WP_Error on failure.
     */
    public function check_api_key( WP_REST_Request $request ) {
        $stored_key   = get_option( 'scalz_seo_api_key', '' );
        $provided_key = $request->get_header( 'X-Scalz-API-Key' );

        if ( empty( $stored_key ) ) {
            return new WP_Error(
                'scalz_no_api_key',
                __( 'No API key configured. Please set one in Settings > Scalz SEO Automator.', 'scalz-seo-automator' ),
                [ 'status' => 500 ]
            );
        }

        if ( ! hash_equals( $stored_key, (string) $provided_key ) ) {
            return new WP_Error(
                'scalz_invalid_api_key',
                __( 'Invalid API key.', 'scalz-seo-automator' ),
                [ 'status' => 401 ]
            );
        }

        return true;
    }

    // ─── Route Handlers ───────────────────────────────────────────────────────────────────────

    /**
     * GET /status
     */
    public function route_status( WP_REST_Request $request ): WP_REST_Response {
        return rest_ensure_response( [
            'status'       => 'ok',
            'version'      => SCALZ_SEO_VERSION,
            'integrations' => $this->integration_manager->get_active_integrations(),
            'timestamp'    => current_time( 'c' ),
        ] );
    }

    /**
     * GET /site-info
     */
    public function route_site_info( WP_REST_Request $request ): WP_REST_Response {
        global $wp_version;

        $active_plugins = get_option( 'active_plugins', [] );
        $theme          = wp_get_theme();

        return rest_ensure_response( [
            'site_title'     => get_bloginfo( 'name' ),
            'site_url'       => get_site_url(),
            'wp_version'     => $wp_version,
            'php_version'    => PHP_VERSION,
            'active_theme'   => [
                'name'    => $theme->get( 'Name' ),
                'version' => $theme->get( 'Version' ),
            ],
            'active_plugins' => $active_plugins,
            'plugin_version' => SCALZ_SEO_VERSION,
        ] );
    }

    /**
     * POST /plugins/install
     */
    public function route_plugins_install( WP_REST_Request $request ) {
        $url         = $request->get_param( 'plugin_file_url' );
        $license_key = $request->get_param( 'license_key' );

        $result = $this->plugin_installer->install_and_activate( $url, $license_key );

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return rest_ensure_response( $result );
    }

    /**
     * POST /pages/update-titles
     */
    public function route_update_titles( WP_REST_Request $request ) {
        $pages = $request->get_param( 'pages' );

        if ( ! is_array( $pages ) || empty( $pages ) ) {
            return new WP_Error( 'scalz_invalid_pages', __( 'pages must be a non-empty array.', 'scalz-seo-automator' ), [ 'status' => 400 ] );
        }

        $result = $this->seo_manager->update_page_titles( $pages );

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return rest_ensure_response( $result );
    }

    /**
     * POST /seo/meta-descriptions
     */
    public function route_meta_descriptions( WP_REST_Request $request ) {
        $auto_generate = (bool) $request->get_param( 'auto_generate' );
        $pages         = $request->get_param( 'pages' );
        $ai_config     = $request->get_param( 'ai_config' );

        if ( $auto_generate ) {
            $result = $this->seo_manager->auto_generate_meta_descriptions( $ai_config );
        } else {
            if ( ! is_array( $pages ) || empty( $pages ) ) {
                return new WP_Error( 'scalz_invalid_pages', __( 'pages must be a non-empty array when auto_generate is false.', 'scalz-seo-automator' ), [ 'status' => 400 ] );
            }
            $result = $this->seo_manager->update_meta_descriptions( $pages );
        }

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return rest_ensure_response( $result );
    }

    /**
     * POST /content/acf-update
     */
    public function route_acf_update( WP_REST_Request $request ) {
        $result = $this->content_manager->update_acf_field(
            (int) $request->get_param( 'page_id' ),
            $request->get_param( 'field_name' ),
            $request->get_param( 'content' ),
            $request->get_param( 'field_type' )
        );

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return rest_ensure_response( $result );
    }

    /**
     * POST /content/generate
     */
    public function route_content_generate( WP_REST_Request $request ) {
        $result = $this->content_manager->generate_and_save_content(
            (int) $request->get_param( 'page_id' ),
            $request->get_param( 'field_name' ),
            $request->get_param( 'prompt_template' ),
            (array) $request->get_param( 'variables' )
        );

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return rest_ensure_response( $result );
    }

    /**
     * POST /seo/alt-tags
     */
    public function route_alt_tags( WP_REST_Request $request ) {
        $page_id = $request->get_param( 'page_id' );
        $result  = $this->seo_manager->update_alt_tags( $page_id ? (int) $page_id : null );

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return rest_ensure_response( $result );
    }

    /**
     * POST /linking/run
     */
    public function route_linking_run( WP_REST_Request $request ) {
        $post_ids = (array) $request->get_param( 'post_ids' );
        $result   = $this->integration_manager->run_link_whisper( $post_ids );

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return rest_ensure_response( $result );
    }

    /**
     * GET /sitemap/posts
     */
    public function route_sitemap_posts( WP_REST_Request $request ) {
        $result = $this->blog_manager->get_sitemap_posts();

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return rest_ensure_response( $result );
    }

    /**
     * POST /blogs/generate-titles
     */
    public function route_blogs_generate_titles( WP_REST_Request $request ) {
        $result = $this->blog_manager->generate_blog_titles(
            (int) $request->get_param( 'count' ),
            (string) $request->get_param( 'niche' ),
            (string) $request->get_param( 'location' ),
            (array) $request->get_param( 'existing_titles' )
        );

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return rest_ensure_response( $result );
    }

    /**
     * POST /blogs/create
     */
    public function route_blogs_create( WP_REST_Request $request ) {
        $result = $this->blog_manager->create_blog_post(
            $request->get_param( 'title' ),
            $request->get_param( 'content' ),
            (array) $request->get_param( 'categories' ),
            (array) $request->get_param( 'tags' )
        );

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return rest_ensure_response( $result );
    }

    /**
     * POST /blogs/fix-headings
     */
    public function route_blogs_fix_headings( WP_REST_Request $request ) {
        $result = $this->blog_manager->fix_post_headings( (int) $request->get_param( 'post_id' ) );

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return rest_ensure_response( $result );
    }

    /**
     * POST /schema/faq
     */
    public function route_schema_faq( WP_REST_Request $request ) {
        $result = $this->schema_manager->inject_faq_schema(
            (int) $request->get_param( 'post_id' ),
            (array) $request->get_param( 'faqs' )
        );

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return rest_ensure_response( $result );
    }

    /**
     * POST /ai/configure
     */
    public function route_ai_configure( WP_REST_Request $request ) {
        $result = $this->integration_manager->configure_ai(
            $request->get_param( 'provider' ),
            $request->get_param( 'api_key' ),
            $request->get_param( 'model' ),
            (float) $request->get_param( 'temperature' )
        );

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return rest_ensure_response( $result );
    }

    /**
     * POST /rankmath/optimize
     */
    public function route_rankmath_optimize( WP_REST_Request $request ) {
        $result = $this->integration_manager->rankmath_optimize(
            (int) $request->get_param( 'post_id' ),
            $request->get_param( 'focus_keyword' )
        );

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return rest_ensure_response( $result );
    }

    // ─── Internal Linking Routes ───────────────────────────────────────────────────────────

    /**
     * POST /linking/suggestions
     */
    public function route_linking_suggestions( WP_REST_Request $request ) {
        if ( ! $this->internal_linker ) {
            return new WP_Error( 'scalz_no_linker', 'Internal linker not available.', [ 'status' => 500 ] );
        }
        $suggestions = $this->internal_linker->get_suggestions( (int) $request->get_param( 'post_id' ) );
        return rest_ensure_response( $suggestions );
    }

    /**
     * POST /linking/insert
     */
    public function route_linking_insert( WP_REST_Request $request ) {
        if ( ! $this->internal_linker ) {
            return new WP_Error( 'scalz_no_linker', 'Internal linker not available.', [ 'status' => 500 ] );
        }
        $result = $this->internal_linker->insert_links(
            (int) $request->get_param( 'post_id' ),
            [],
            (int) $request->get_param( 'max_links' )
        );
        return rest_ensure_response( $result );
    }

    /**
     * POST /linking/bulk
     */
    public function route_linking_bulk( WP_REST_Request $request ) {
        if ( ! $this->internal_linker ) {
            return new WP_Error( 'scalz_no_linker', 'Internal linker not available.', [ 'status' => 500 ] );
        }
        $result = $this->internal_linker->run_bulk_linking(
            $request->get_param( 'post_types' ) ?: [ 'post', 'page' ],
            (int) $request->get_param( 'max_links' )
        );
        return rest_ensure_response( $result );
    }

    /**
     * GET /linking/report
     */
    public function route_linking_report( WP_REST_Request $request ) {
        if ( ! $this->internal_linker ) {
            return new WP_Error( 'scalz_no_linker', 'Internal linker not available.', [ 'status' => 500 ] );
        }
        return rest_ensure_response( $this->internal_linker->get_link_report() );
    }

    /**
     * GET /linking/orphans
     */
    public function route_linking_orphans( WP_REST_Request $request ) {
        if ( ! $this->internal_linker ) {
            return new WP_Error( 'scalz_no_linker', 'Internal linker not available.', [ 'status' => 500 ] );
        }
        return rest_ensure_response( $this->internal_linker->get_orphan_posts() );
    }

    /**
     * POST /linking/index — Rebuild the link index.
     */
    public function route_linking_build_index( WP_REST_Request $request ) {
        if ( ! $this->internal_linker ) {
            return new WP_Error( 'scalz_no_linker', 'Internal linker not available.', [ 'status' => 500 ] );
        }
        return rest_ensure_response( $this->internal_linker->build_link_index( true ) );
    }

    /**
     * PUT /linking/config — Update linker configuration.
     */
    public function route_linking_config( WP_REST_Request $request ) {
        if ( ! $this->internal_linker ) {
            return new WP_Error( 'scalz_no_linker', 'Internal linker not available.', [ 'status' => 500 ] );
        }
        $config = $request->get_json_params();
        return rest_ensure_response( $this->internal_linker->update_config( $config ) );
    }

    /**
     * GET /linking/config — Get linker configuration.
     */
    public function route_linking_get_config( WP_REST_Request $request ) {
        if ( ! $this->internal_linker ) {
            return new WP_Error( 'scalz_no_linker', 'Internal linker not available.', [ 'status' => 500 ] );
        }
        return rest_ensure_response( $this->internal_linker->get_config() );
    }

    /**
     * GET /acf/detect-fields
     * Detects all ACF field groups and their fields on the site.
     */
    public function route_acf_detect_fields( WP_REST_Request $request ) {
        $result = [
            'acf_active'   => false,
            'field_groups'  => [],
            'all_fields'    => [],
            'post_types'    => [],
        ];

        // Check if ACF is active
        if ( ! function_exists( 'acf_get_field_groups' ) ) {
            $result['message'] = 'ACF (Advanced Custom Fields) is not installed or active on this site.';
            return rest_ensure_response( $result );
        }

        $result['acf_active'] = true;

        // Get all field groups
        $groups = acf_get_field_groups();

        foreach ( $groups as $group ) {
            $group_data = [
                'key'       => $group['key'],
                'title'     => $group['title'],
                'active'    => $group['active'],
                'location'  => $group['location'] ?? [],
                'fields'    => [],
            ];

            // Get fields for this group
            $fields = acf_get_fields( $group['key'] );
            if ( $fields ) {
                foreach ( $fields as $field ) {
                    $field_data = [
                        'key'           => $field['key'],
                        'name'          => $field['name'],
                        'label'         => $field['label'],
                        'type'          => $field['type'],
                        'required'      => ! empty( $field['required'] ),
                        'instructions'  => $field['instructions'] ?? '',
                    ];

                    // For select/radio/checkbox, include choices
                    if ( in_array( $field['type'], [ 'select', 'radio', 'checkbox' ], true ) && ! empty( $field['choices'] ) ) {
                        $field_data['choices'] = $field['choices'];
                    }

                    // For repeater/group/flexible, note sub_fields count
                    if ( in_array( $field['type'], [ 'repeater', 'group', 'flexible_content' ], true ) ) {
                        $sub_fields = $field['sub_fields'] ?? [];
                        $field_data['sub_fields_count'] = count( $sub_fields );
                        $field_data['sub_fields'] = array_map( function( $sf ) {
                            return [
                                'key'   => $sf['key'],
                                'name'  => $sf['name'],
                                'label' => $sf['label'],
                                'type'  => $sf['type'],
                            ];
                        }, $sub_fields );
                    }

                    $group_data['fields'][] = $field_data;
                    $result['all_fields'][] = $field_data;
                }
            }

            $result['field_groups'][] = $group_data;
        }

        // Get all public post types
        $post_types = get_post_types( [ 'public' => true ], 'objects' );
        foreach ( $post_types as $pt ) {
            $result['post_types'][] = [
                'name'  => $pt->name,
                'label' => $pt->label,
                'count' => (int) wp_count_posts( $pt->name )->publish,
            ];
        }

        $result['total_groups'] = count( $result['field_groups'] );
        $result['total_fields'] = count( $result['all_fields'] );

        return rest_ensure_response( $result );
    }
}
