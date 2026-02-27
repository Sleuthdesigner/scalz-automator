<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

class Scalz_Api_Endpoints {
    private static string $ns = 'scalz/v1';

    public static function init(): void {
        add_action( 'rest_api_init', [ __CLASS__, 'register_routes' ] );
    }

    public static function register_routes(): void {
        $ns = self::$ns;
        register_rest_route( $ns, '/status', [ 'methods' => 'GET', 'callback' => [ __CLASS__, 'handle_status' ], 'permission_callback' => [ __CLASS__, 'check_api_key' ] ] );
        register_rest_route( $ns, '/settings', [ [ 'methods' => 'GET', 'callback' => [ __CLASS__, 'handle_get_settings' ], 'permission_callback' => [ __CLASS__, 'check_api_key' ] ], [ 'methods' => 'POST', 'callback' => [ __CLASS__, 'handle_post_settings' ], 'permission_callback' => [ __CLASS__, 'check_api_key' ] ] ] );
        register_rest_route( $ns, '/plugins/install', [ 'methods' => 'POST', 'callback' => [ __CLASS__, 'handle_plugin_install' ], 'permission_callback' => [ __CLASS__, 'check_api_key' ] ] );
        register_rest_route( $ns, '/seo/titles', [ [ 'methods' => 'GET', 'callback' => [ __CLASS__, 'handle_get_titles' ], 'permission_callback' => [ __CLASS__, 'check_api_key' ] ], [ 'methods' => 'POST', 'callback' => [ __CLASS__, 'handle_post_titles' ], 'permission_callback' => [ __CLASS__, 'check_api_key' ] ] ] );
        register_rest_route( $ns, '/seo/descriptions', [ [ 'methods' => 'GET', 'callback' => [ __CLASS__, 'handle_get_descriptions' ], 'permission_callback' => [ __CLASS__, 'check_api_key' ] ], [ 'methods' => 'POST', 'callback' => [ __CLASS__, 'handle_post_descriptions' ], 'permission_callback' => [ __CLASS__, 'check_api_key' ] ] ] );
        register_rest_route( $ns, '/seo/focus-keywords', [ [ 'methods' => 'GET', 'callback' => [ __CLASS__, 'handle_get_focus_keywords' ], 'permission_callback' => [ __CLASS__, 'check_api_key' ] ], [ 'methods' => 'POST', 'callback' => [ __CLASS__, 'handle_post_focus_keywords' ], 'permission_callback' => [ __CLASS__, 'check_api_key' ] ] ] );
        register_rest_route( $ns, '/seo/alt-tags', [ [ 'methods' => 'GET', 'callback' => [ __CLASS__, 'handle_get_alt_tags' ], 'permission_callback' => [ __CLASS__, 'check_api_key' ] ], [ 'methods' => 'POST', 'callback' => [ __CLASS__, 'handle_post_alt_tags' ], 'permission_callback' => [ __CLASS__, 'check_api_key' ] ] ] );
        register_rest_route( $ns, '/content/acf', [ [ 'methods' => 'GET', 'callback' => [ __CLASS__, 'handle_get_acf' ], 'permission_callback' => [ __CLASS__, 'check_api_key' ] ], [ 'methods' => 'POST', 'callback' => [ __CLASS__, 'handle_post_acf' ], 'permission_callback' => [ __CLASS__, 'check_api_key' ] ] ] );
        register_rest_route( $ns, '/content/h2', [ [ 'methods' => 'GET', 'callback' => [ __CLASS__, 'handle_get_h2' ], 'permission_callback' => [ __CLASS__, 'check_api_key' ] ], [ 'methods' => 'POST', 'callback' => [ __CLASS__, 'handle_post_h2' ], 'permission_callback' => [ __CLASS__, 'check_api_key' ] ] ] );
        register_rest_route( $ns, '/blog/generate', [ 'methods' => 'POST', 'callback' => [ __CLASS__, 'handle_blog_generate' ], 'permission_callback' => [ __CLASS__, 'check_api_key' ] ] );
        register_rest_route( $ns, '/blog/batch', [ 'methods' => 'POST', 'callback' => [ __CLASS__, 'handle_blog_batch' ], 'permission_callback' => [ __CLASS__, 'check_api_key' ] ] );
        register_rest_route( $ns, '/schema/faq', [ 'methods' => 'POST', 'callback' => [ __CLASS__, 'handle_schema_faq' ], 'permission_callback' => [ __CLASS__, 'check_api_key' ] ] );
        register_rest_route( $ns, '/sitemap/parse', [ 'methods' => 'POST', 'callback' => [ __CLASS__, 'handle_sitemap_parse' ], 'permission_callback' => [ __CLASS__, 'check_api_key' ] ] );
        register_rest_route( $ns, '/linking/suggestions', [ 'methods' => 'GET', 'callback' => [ __CLASS__, 'handle_linking_suggestions' ], 'permission_callback' => [ __CLASS__, 'check_api_key' ] ] );
        register_rest_route( $ns, '/linking/report', [ 'methods' => 'GET', 'callback' => [ __CLASS__, 'handle_linking_report' ], 'permission_callback' => [ __CLASS__, 'check_api_key' ] ] );
        register_rest_route( $ns, '/linking/orphans', [ 'methods' => 'GET', 'callback' => [ __CLASS__, 'handle_linking_orphans' ], 'permission_callback' => [ __CLASS__, 'check_api_key' ] ] );
        register_rest_route( $ns, '/linking/apply', [ 'methods' => 'POST', 'callback' => [ __CLASS__, 'handle_linking_apply' ], 'permission_callback' => [ __CLASS__, 'check_api_key' ] ] );
        register_rest_route( $ns, '/linking/auto', [ 'methods' => 'POST', 'callback' => [ __CLASS__, 'handle_linking_auto' ], 'permission_callback' => [ __CLASS__, 'check_api_key' ] ] );
        register_rest_route( $ns, '/linking/index', [ 'methods' => 'POST', 'callback' => [ __CLASS__, 'handle_linking_index' ], 'permission_callback' => [ __CLASS__, 'check_api_key' ] ] );
        register_rest_route( $ns, '/linking/config', [ [ 'methods' => 'GET', 'callback' => [ __CLASS__, 'handle_get_linking_config' ], 'permission_callback' => [ __CLASS__, 'check_api_key' ] ], [ 'methods' => 'PUT', 'callback' => [ __CLASS__, 'handle_put_linking_config' ], 'permission_callback' => [ __CLASS__, 'check_api_key' ] ] ] );
    }

    public static function check_api_key( WP_REST_Request $request ): bool {
        $provided = $request->get_header( 'X-Scalz-API-Key' );
        $stored   = get_option( 'scalz_seo_api_key', '' );
        return ! empty( $provided ) && hash_equals( $stored, $provided );
    }

    public static function handle_status( WP_REST_Request $r ): WP_REST_Response { return new WP_REST_Response( [ 'status' => 'ok', 'version' => SCALZ_SEO_VERSION, 'site_url' => get_bloginfo( 'url' ) ], 200 ); }
    public static function handle_get_settings( WP_REST_Request $r ): WP_REST_Response { return class_exists( 'Scalz_Settings' ) ? new WP_REST_Response( Scalz_Settings::get_all_settings(), 200 ) : new WP_REST_Response( [ 'error' => 'Not available' ], 500 ); }
    public static function handle_post_settings( WP_REST_Request $r ): WP_REST_Response { if ( class_exists( 'Scalz_Settings' ) ) { Scalz_Settings::update_settings( $r->get_json_params() ); return new WP_REST_Response( [ 'success' => true ], 200 ); } return new WP_REST_Response( [ 'error' => 'Not available' ], 500 ); }
    public static function handle_plugin_install( WP_REST_Request $r ): WP_REST_Response { $p = sanitize_text_field( $r->get_json_params()['plugin'] ?? '' ); if ( ! $p ) return new WP_REST_Response( [ 'error' => 'Plugin key required' ], 400 ); $res = Scalz_Plugin_Installer::install( $p ); return new WP_REST_Response( $res, isset( $res['error'] ) ? 500 : 200 ); }
    public static function handle_get_titles( WP_REST_Request $r ): WP_REST_Response { return class_exists( 'Scalz_SEO_Manager' ) ? new WP_REST_Response( Scalz_SEO_Manager::get_titles(), 200 ) : new WP_REST_Response( [ 'error' => 'Not available' ], 500 ); }
    public static function handle_post_titles( WP_REST_Request $r ): WP_REST_Response { return class_exists( 'Scalz_SEO_Manager' ) ? new WP_REST_Response( Scalz_SEO_Manager::generate_titles( $r->get_json_params() ), 200 ) : new WP_REST_Response( [ 'error' => 'Not available' ], 500 ); }
    public static function handle_get_descriptions( WP_REST_Request $r ): WP_REST_Response { return class_exists( 'Scalz_SEO_Manager' ) ? new WP_REST_Response( Scalz_SEO_Manager::get_descriptions(), 200 ) : new WP_REST_Response( [ 'error' => 'Not available' ], 500 ); }
    public static function handle_post_descriptions( WP_REST_Request $r ): WP_REST_Response { return class_exists( 'Scalz_SEO_Manager' ) ? new WP_REST_Response( Scalz_SEO_Manager::generate_descriptions( $r->get_json_params() ), 200 ) : new WP_REST_Response( [ 'error' => 'Not available' ], 500 ); }
    public static function handle_get_focus_keywords( WP_REST_Request $r ): WP_REST_Response { return class_exists( 'Scalz_SEO_Manager' ) ? new WP_REST_Response( Scalz_SEO_Manager::get_focus_keywords(), 200 ) : new WP_REST_Response( [ 'error' => 'Not available' ], 500 ); }
    public static function handle_post_focus_keywords( WP_REST_Request $r ): WP_REST_Response { return class_exists( 'Scalz_SEO_Manager' ) ? new WP_REST_Response( Scalz_SEO_Manager::generate_focus_keywords( $r->get_json_params() ), 200 ) : new WP_REST_Response( [ 'error' => 'Not available' ], 500 ); }
    public static function handle_get_alt_tags( WP_REST_Request $r ): WP_REST_Response { return class_exists( 'Scalz_SEO_Manager' ) ? new WP_REST_Response( Scalz_SEO_Manager::get_alt_tags(), 200 ) : new WP_REST_Response( [ 'error' => 'Not available' ], 500 ); }
    public static function handle_post_alt_tags( WP_REST_Request $r ): WP_REST_Response { return class_exists( 'Scalz_SEO_Manager' ) ? new WP_REST_Response( Scalz_SEO_Manager::generate_alt_tags( $r->get_json_params() ), 200 ) : new WP_REST_Response( [ 'error' => 'Not available' ], 500 ); }
    public static function handle_get_acf( WP_REST_Request $r ): WP_REST_Response { return class_exists( 'Scalz_Content_Manager' ) ? new WP_REST_Response( Scalz_Content_Manager::get_acf_content(), 200 ) : new WP_REST_Response( [ 'error' => 'Not available' ], 500 ); }
    public static function handle_post_acf( WP_REST_Request $r ): WP_REST_Response { return class_exists( 'Scalz_Content_Manager' ) ? new WP_REST_Response( Scalz_Content_Manager::generate_acf_content( $r->get_json_params() ), 200 ) : new WP_REST_Response( [ 'error' => 'Not available' ], 500 ); }
    public static function handle_get_h2( WP_REST_Request $r ): WP_REST_Response { return class_exists( 'Scalz_Content_Manager' ) ? new WP_REST_Response( Scalz_Content_Manager::get_h2_headings(), 200 ) : new WP_REST_Response( [ 'error' => 'Not available' ], 500 ); }
    public static function handle_post_h2( WP_REST_Request $r ): WP_REST_Response { return class_exists( 'Scalz_Content_Manager' ) ? new WP_REST_Response( Scalz_Content_Manager::generate_h2_headings( $r->get_json_params() ), 200 ) : new WP_REST_Response( [ 'error' => 'Not available' ], 500 ); }
    public static function handle_blog_generate( WP_REST_Request $r ): WP_REST_Response { return class_exists( 'Scalz_Blog_Manager' ) ? new WP_REST_Response( Scalz_Blog_Manager::generate_post( $r->get_json_params() ), 200 ) : new WP_REST_Response( [ 'error' => 'Not available' ], 500 ); }
    public static function handle_blog_batch( WP_REST_Request $r ): WP_REST_Response { return class_exists( 'Scalz_Blog_Manager' ) ? new WP_REST_Response( Scalz_Blog_Manager::batch_generate( $r->get_json_params() ), 200 ) : new WP_REST_Response( [ 'error' => 'Not available' ], 500 ); }
    public static function handle_schema_faq( WP_REST_Request $r ): WP_REST_Response { return class_exists( 'Scalz_Schema_Manager' ) ? new WP_REST_Response( Scalz_Schema_Manager::generate_faq( $r->get_json_params() ), 200 ) : new WP_REST_Response( [ 'error' => 'Not available' ], 500 ); }
    public static function handle_sitemap_parse( WP_REST_Request $r ): WP_REST_Response {
        $site_url = get_bloginfo( 'url' );
        $sitemap_urls = [ trailingslashit( $site_url ) . 'sitemap_index.xml', trailingslashit( $site_url ) . 'sitemap.xml' ];
        $pages = [];
        foreach ( $sitemap_urls as $url ) {
            $response = wp_remote_get( $url, [ 'timeout' => 10 ] );
            if ( is_wp_error( $response ) ) continue;
            $body = wp_remote_retrieve_body( $response );
            if ( empty( $body ) ) continue;
            $xml = simplexml_load_string( $body );
            if ( ! $xml ) continue;
            if ( isset( $xml->sitemap ) ) {
                foreach ( $xml->sitemap as $sm ) {
                    $child = wp_remote_get( (string) $sm->loc, [ 'timeout' => 10 ] );
                    if ( is_wp_error( $child ) ) continue;
                    $child_xml = simplexml_load_string( wp_remote_retrieve_body( $child ) );
                    if ( ! $child_xml || ! isset( $child_xml->url ) ) continue;
                    foreach ( $child_xml->url as $u ) { $pages[] = (string) $u->loc; }
                }
                break;
            }
            if ( isset( $xml->url ) ) { foreach ( $xml->url as $u ) { $pages[] = (string) $u->loc; } break; }
        }
        return new WP_REST_Response( [ 'pages' => $pages, 'count' => count( $pages ) ], 200 );
    }
    public static function handle_linking_suggestions( WP_REST_Request $r ): WP_REST_Response { return class_exists( 'Scalz_Internal_Linker' ) ? new WP_REST_Response( Scalz_Internal_Linker::get_suggestions( intval( $r->get_param( 'page_id' ) ) ), 200 ) : new WP_REST_Response( [ 'error' => 'Not available' ], 500 ); }
    public static function handle_linking_report( WP_REST_Request $r ): WP_REST_Response { return class_exists( 'Scalz_Internal_Linker' ) ? new WP_REST_Response( Scalz_Internal_Linker::get_report(), 200 ) : new WP_REST_Response( [ 'error' => 'Not available' ], 500 ); }
    public static function handle_linking_orphans( WP_REST_Request $r ): WP_REST_Response { return class_exists( 'Scalz_Internal_Linker' ) ? new WP_REST_Response( Scalz_Internal_Linker::get_orphans(), 200 ) : new WP_REST_Response( [ 'error' => 'Not available' ], 500 ); }
    public static function handle_linking_apply( WP_REST_Request $r ): WP_REST_Response { return class_exists( 'Scalz_Internal_Linker' ) ? new WP_REST_Response( Scalz_Internal_Linker::apply_links( $r->get_json_params() ), 200 ) : new WP_REST_Response( [ 'error' => 'Not available' ], 500 ); }
    public static function handle_linking_auto( WP_REST_Request $r ): WP_REST_Response { return class_exists( 'Scalz_Internal_Linker' ) ? new WP_REST_Response( Scalz_Internal_Linker::auto_link( $r->get_json_params() ), 200 ) : new WP_REST_Response( [ 'error' => 'Not available' ], 500 ); }
    public static function handle_linking_index( WP_REST_Request $r ): WP_REST_Response { return class_exists( 'Scalz_Internal_Linker' ) ? new WP_REST_Response( Scalz_Internal_Linker::index_content(), 200 ) : new WP_REST_Response( [ 'error' => 'Not available' ], 500 ); }
    public static function handle_get_linking_config( WP_REST_Request $r ): WP_REST_Response { return class_exists( 'Scalz_Internal_Linker' ) ? new WP_REST_Response( Scalz_Internal_Linker::get_config(), 200 ) : new WP_REST_Response( [ 'error' => 'Not available' ], 500 ); }
    public static function handle_put_linking_config( WP_REST_Request $r ): WP_REST_Response { return class_exists( 'Scalz_Internal_Linker' ) ? new WP_REST_Response( Scalz_Internal_Linker::update_config( $r->get_json_params() ), 200 ) : new WP_REST_Response( [ 'error' => 'Not available' ], 500 ); }
}
